#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
export COMPOSE_ANSI=never COMPOSE_PROGRESS=plain
unset HTTP_PORT
exec 9>"$HOME/.hackathon-deploy.lock"
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
release_id=__RELEASE_ID__
validate_only=__VALIDATE_ONLY__
baseline=__BASELINE_DATABASE__
export DATABASE_URL
DATABASE_URL=$(printf '%s' '__DATABASE_URL_BASE64__' | base64 -d)
export ASKPOOL_APP_PASSWORD_FILE
ASKPOOL_APP_PASSWORD_FILE=$(printf '%s' '__APP_PASSWORD_FILE_BASE64__' | base64 -d)
archive="$HOME/hackathon-$release_id.tar.gz"
release="$HOME/hackathon-releases/$release_id"
candidate="hackathon-check-$release_id"
previous=""
switched=0

# Discover only the secret's path. Never print or upload its contents.
if [ -z "$ASKPOOL_APP_PASSWORD_FILE" ]; then
    mapfile -t secret_paths < <(find "$HOME" -maxdepth 6 -type f -path '*/secrets/app_password' 2>/dev/null)
    if [ "${#secret_paths[@]}" -ne 1 ]; then
        echo 'Set -AppPasswordFile to the absolute VM path of secrets/app_password (automatic discovery needs exactly one match).' >&2
        exit 1
    fi
    ASKPOOL_APP_PASSWORD_FILE="${secret_paths[0]}"
fi
case "$ASKPOOL_APP_PASSWORD_FILE" in /*) ;; *) echo 'AppPasswordFile must be an absolute VM path.' >&2; exit 1 ;; esac
test -s "$ASKPOOL_APP_PASSWORD_FILE" || { echo 'The VM app_password secret is missing or empty.' >&2; exit 1; }
docker network inspect askpool_shared >/dev/null

mkdir -p "$release"
echo '__ARCHIVE_HASH__  '"$archive" | sha256sum -c -
tar -xzf "$archive" -C "$release"
cd "$release"

# Persist configuration for later inspection/restarts/rollback; no password is stored here.
export DATABASE_BASELINE=false
if [ "$baseline" -eq 1 ]; then DATABASE_BASELINE=true; fi
printf "ASKPOOL_APP_PASSWORD_FILE='%s'\nDATABASE_URL='%s'\nDATABASE_BASELINE=%s\n" \
    "$ASKPOOL_APP_PASSWORD_FILE" "$DATABASE_URL" "$DATABASE_BASELINE" > .env

candidate_password=$(cat /proc/sys/kernel/random/uuid)
cat > compose.candidate.yaml <<YAML
services:
  backend:
    environment:
      DATABASE_URL: jdbc:postgresql://candidate-db:5432/askpool
      DATABASE_USER: postgres
      DATABASE_PASSWORD: $candidate_password
      DATABASE_BASELINE: "false"
      APP_TESTING_PERMISSIONS: "true"
    depends_on:
      candidate-db:
        condition: service_healthy
  candidate-db:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: askpool
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: $candidate_password
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d askpool"]
      interval: 2s
      timeout: 5s
      retries: 30
    volumes:
      - candidate-postgres:/var/lib/postgresql/data
volumes:
  candidate-postgres:
YAML

candidate_compose() {
    HTTP_PORT=127.0.0.1:18080 docker compose -p "$candidate" -f "$release/compose.yaml" -f "$release/compose.candidate.yaml" "$@"
}

cleanup() {
    result=$?
    trap - EXIT
    if [ "$result" -ne 0 ]; then
        candidate_compose logs --tail 40 backend >&2 || true
    fi
    candidate_compose down --volumes >/dev/null 2>&1 || true
    if [ "$result" -ne 0 ] && [ "$switched" -eq 1 ]; then
        echo 'Deployment failed; restoring previous application release. PostgreSQL data is retained.' >&2
        docker compose -p hackathon -f "$release/compose.yaml" logs --tail 40 backend >&2 || true
        docker compose -p hackathon -f "$release/compose.yaml" down || true
        if [ -n "$previous" ] && [ -f "$previous/compose.yaml" ]; then
            if (unset DATABASE_URL DATABASE_BASELINE ASKPOOL_APP_PASSWORD_FILE MODERATION_IMAGE_TAG MODERATION_THRESHOLD; cd "$previous" && docker compose -p hackathon up -d --force-recreate); then
                curl -fsS --retry 15 --retry-delay 2 --retry-all-errors http://127.0.0.1:8080/api/hello || true
            else
                echo "ROLLBACK FAILED: inspect $previous manually." >&2
            fi
        else
            docker start template-backend-1 template-frontend-1 || true
        fi
    fi
    exit "$result"
}
trap cleanup EXIT

docker compose -p hackathon config --quiet
docker compose -p hackathon pull backend frontend
docker pull postgres:17-alpine

# Read-only database checks use the application role and the existing mounted secret.
database_command() {
    docker run --rm --network askpool_shared \
        -v "$ASKPOOL_APP_PASSWORD_FILE:/run/secrets/app_password:ro" \
        "${database_client_image:-postgres:17-alpine}" sh -c \
        'export PGPASSWORD="$(cat /run/secrets/app_password)"; command="$1"; shift; exec "$command" "$@"' \
        sh "$@"
}
database_uri="${DATABASE_URL#jdbc:}"
server_major=$(database_command psql "$database_uri" -U askpool_app -v ON_ERROR_STOP=1 -Atqc "SELECT current_setting('server_version_num')::int / 10000")
[[ "$server_major" =~ ^[0-9]+$ ]] && [ "$server_major" -ge 12 ] && [ "$server_major" -le 99 ] || { echo 'Unsupported PostgreSQL server version.' >&2; exit 1; }
database_client_image="postgres:$server_major-alpine"
docker pull "$database_client_image"
db_state=$(database_command psql "$database_uri" -U askpool_app -v ON_ERROR_STOP=1 -Atqc \
    "SELECT (to_regclass('public.flyway_schema_history') IS NOT NULL)::int,
            count(*) FILTER (WHERE c.relname IN ('users','lectures','questions')),
            count(*) FILTER (WHERE c.relname IN ('users','lectures','questions') AND pg_get_userbyid(c.relowner) = 'askpool_app')
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'")
IFS='|' read -r tracked table_count owned_count <<< "$db_state"
if [ "$table_count" -gt 0 ] && [ "$table_count" -ne 3 ]; then
    echo 'Database has an incomplete initial schema; review deploy/README.md before deploying.' >&2; exit 1
fi
if [ "$owned_count" -ne "$table_count" ]; then
    echo 'Existing tables must be owned by askpool_app before migrations. See deploy/README.md.' >&2; exit 1
fi
if [ "$tracked" -eq 0 ] && [ "$table_count" -eq 3 ] && [ "$baseline" -ne 1 ]; then
    echo 'Existing schema needs one-time adoption. Verify it matches V1, then rerun with -BaselineDatabase. See deploy/README.md.' >&2; exit 1
fi

check_app() {
    local port="$1" html asset route code identity_json
    curl -fsS --max-time 5 --retry 30 --retry-delay 2 --retry-all-errors "http://127.0.0.1:$port/api/hello"
    identity_json=$(curl -fsS --max-time 5 -H 'X-User-Id: deploy-check@ethz.ch' -H 'X-User-Name: Deploy%20Check' "http://127.0.0.1:$port/api/me")
    test "$identity_json" = '{"id":"deploy-check@ethz.ch","name":"Deploy Check"}'
    curl -fsS --max-time 5 -H 'X-User-Id: deploy-check@ethz.ch' -o /dev/null "http://127.0.0.1:$port/api/lectures"
    for route in api/me api/lectures; do
        code=$(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/$route")
        test "$code" = 401 || { echo "Expected unauthenticated /$route to return 401; got $code" >&2; return 1; }
    done
    html=$(curl -fsS --max-time 10 "http://127.0.0.1:$port/")
    asset=$(printf '%s' "$html" | sed -n 's/.*src="\([^"]*\.js\)".*/\1/p' | head -n 1)
    test -n "$asset"
    curl -fsS --max-time 10 -o /dev/null "http://127.0.0.1:$port$asset"
    for route in student professor; do
        html=$(curl -fsS --max-time 10 "http://127.0.0.1:$port/$route")
        printf '%s' "$html" | grep -qF "$asset"
    done
}

echo 'Starting candidate on localhost:18080 with an isolated disposable PostgreSQL database...'
candidate_compose up -d
check_app 18080
candidate_compose down --volumes
if [ "$validate_only" -eq 1 ]; then
    echo 'Candidate validation passed. Production application and database were not changed.'
    exit 0
fi

# Create a private backup before production migrations; never stream data to the terminal.
database_command pg_dump "$database_uri" -U askpool_app --no-owner --no-acl > "$release/database-before.sql"
previous=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' hackathon-frontend-1 2>/dev/null || true)
echo 'Switching production deployment on port 8080...'
switched=1
for demo in template-frontend-1 template-backend-1; do
    if docker inspect "$demo" >/dev/null 2>&1; then docker stop "$demo"; fi
done
docker compose -p hackathon up -d --force-recreate --remove-orphans
check_app 8080
# Recreate Java with baseline disabled after successful adoption.
sed -i 's/^DATABASE_BASELINE=.*/DATABASE_BASELINE=false/' .env
export DATABASE_BASELINE=false
docker compose -p hackathon up -d --no-deps backend
check_app 8080
docker compose -p hackathon ps
printf '\nDeployed successfully: https://08.hackathon.ethz.ch\nRelease: %s\nPrevious release: %s\nDatabase backup: %s/database-before.sql\n' "$release" "$previous" "$release"
