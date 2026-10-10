#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
export COMPOSE_ANSI=never COMPOSE_PROGRESS=plain
exec 9>"$HOME/.hackathon-deploy.lock"
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
release_id=__RELEASE_ID__
validate_only=__VALIDATE_ONLY__
export MODERATION_IMAGE_TAG="$release_id"
export MODERATION_THRESHOLD=__MODERATION_THRESHOLD__
unset MODERATION_NETWORK_ALIAS
archive="$HOME/moderation-$release_id.tar.gz"
release="$HOME/moderation-releases/$release_id"
candidate="moderation-check-$release_id"
previous=""
switched=0
docker network inspect askpool_shared >/dev/null
mkdir -p "$release"
echo '__ARCHIVE_HASH__  '"$archive" | sha256sum -c -
tar -xzf "$archive" -C "$release"
cd "$release"
printf 'MODERATION_IMAGE_TAG=%s\nMODERATION_THRESHOLD=%s\n' "$MODERATION_IMAGE_TAG" "$MODERATION_THRESHOLD" > .env

candidate_compose() {
    MODERATION_NETWORK_ALIAS="$candidate" docker compose -p "$candidate" -f "$release/compose.yaml" "$@"
}
cleanup() {
    result=$?
    trap - EXIT
    if [ "$result" -ne 0 ]; then candidate_compose logs --tail 40 moderation >&2 || true; fi
    candidate_compose down >/dev/null 2>&1 || true
    if [ "$result" -ne 0 ] && [ "$switched" -eq 1 ]; then
        echo 'Moderation deployment failed; restoring the previous service release.' >&2
        docker compose -p askpool-moderation -f "$release/compose.yaml" logs --tail 40 moderation >&2 || true
        if [ -n "$previous" ] && [ -f "$previous/compose.yaml" ]; then
            # Read the previous release tag/threshold from its own .env.
            (unset MODERATION_IMAGE_TAG MODERATION_THRESHOLD MODERATION_NETWORK_ALIAS;
             cd "$previous";
             docker compose -p askpool-moderation up -d --no-build --force-recreate moderation) || echo 'Moderation rollback failed; inspect the service manually.' >&2
        else
            docker compose -p askpool-moderation -f "$release/compose.yaml" down || true
        fi
    fi
    exit "$result"
}
trap cleanup EXIT

docker compose -p askpool-moderation config --quiet
docker compose -p askpool-moderation build moderation
# Candidate has a distinct network alias so Java keeps using production moderation.
candidate_compose up -d --no-build --wait --wait-timeout 180 moderation
candidate_compose exec -T moderation python check_model.py --url http://127.0.0.1:8090
candidate_compose down
if [ "$validate_only" -eq 1 ]; then
    echo 'Moderation validation passed. Production services were not changed.'
    exit 0
fi
previous=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' askpool-moderation-moderation-1 2>/dev/null || true)
switched=1
docker compose -p askpool-moderation up -d --no-deps --no-build --force-recreate --wait --wait-timeout 180 moderation
docker compose -p askpool-moderation exec -T moderation python check_model.py --url http://127.0.0.1:8090
docker compose -p askpool-moderation ps
printf '\nModeration deployed: %s\nPrevious release: %s\n' "$release" "$previous"
