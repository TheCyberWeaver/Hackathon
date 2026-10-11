#!/usr/bin/env bash
# Run once a minute as the VM deployment user. Docker handles process exits;
# this also recovers services that remain running but stop answering requests.
set -Eeuo pipefail
umask 077
export PATH="/usr/local/bin:/usr/bin:/bin"

mode="${1:-watch}"
case "$mode" in watch|check) ;; *) echo 'Usage: askpool-watchdog.sh [watch|check]' >&2; exit 2 ;; esac

state_dir="$HOME/.local/state/askpool-recovery"
mkdir -p "$state_dir"
exec 9>"$HOME/.hackathon-deploy.lock"
if ! flock -n 9; then
    if [ "$mode" = check ]; then echo 'A deployment is running; check again afterward.' >&2; exit 1; fi
    exit 0 # A deployment owns the stack; retry at the next tick.
fi

log() {
    printf '%s\n' "$*"
    logger -t askpool-watchdog -- "$*"
}
trap 'log "Watchdog failed unexpectedly at line $LINENO"' ERR

is_running() {
    [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null || true)" = true ]
}

ensure_running() {
    local name="$1" project="$2" service="$3" release="$4"
    if is_running "$name"; then return 0; fi
    if [ "$mode" = check ]; then log "$name is not running"; return 1; fi

    if docker inspect "$name" >/dev/null 2>&1; then
        log "Starting stopped container $name"
        docker start "$name" >/dev/null
    elif [ -f "$release/compose.yaml" ]; then
        log "Recreating missing container $name from $release"
        (cd "$release" && docker compose -p "$project" up -d --no-deps --no-build "$service")
    else
        log "Cannot restore $name: release configuration is missing at $release"
        return 1
    fi
    is_running "$name"
}

probe_database() {
    timeout 8 docker exec askpool-postgres pg_isready -U postgres -d askpool >/dev/null 2>&1
}
probe_moderation() {
    timeout 8 docker exec askpool-moderation-moderation-1 python -c \
        "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8090/health', timeout=3)" >/dev/null 2>&1
}
probe_frontend() { curl -fsS --max-time 6 -o /dev/null http://127.0.0.1:8080/; }
probe_backend() { curl -fsS --max-time 6 -o /dev/null http://127.0.0.1:8080/api/hello; }

watch_probe() {
    local name="$1" probe="$2" label="$3" count_file="$state_dir/$1.failures"
    local last_file="$state_dir/$1.last-restart" failures=0 last=0 now
    if "$probe"; then rm -f "$count_file"; return 0; fi
    if [ -r "$count_file" ]; then read -r failures < "$count_file" || true; fi
    [[ "$failures" =~ ^[0-9]+$ ]] || failures=0
    failures=$((failures + 1))
    printf '%s\n' "$failures" > "$count_file"
    log "$label health check failed ($failures consecutive checks)"
    if [ "$failures" -lt 2 ]; then return 1; fi
    if [ -r "$last_file" ]; then read -r last < "$last_file" || true; fi
    [[ "$last" =~ ^[0-9]+$ ]] || last=0
    now=$(date +%s)
    if [ "$((now - last))" -lt 180 ]; then return 1; fi
    log "Restarting unhealthy $name"
    docker restart "$name" >/dev/null
    printf '%s\n' "$now" > "$last_file"
    return 1
}

bad=0
for spec in \
    "askpool-postgres|askpool-db|postgres|$HOME/askpool-db" \
    "hackathon-backend-1|hackathon|backend|$HOME/hackathon-current" \
    "hackathon-frontend-1|hackathon|frontend|$HOME/hackathon-current" \
    "askpool-moderation-moderation-1|askpool-moderation|moderation|$HOME/moderation-current"; do
    IFS='|' read -r name project service release <<< "$spec"
    if ! ensure_running "$name" "$project" "$service" "$release"; then bad=1; fi
done

if [ "$mode" = check ]; then
    for probe in probe_database probe_frontend probe_backend probe_moderation; do
        if "$probe"; then printf '%s: healthy\n' "${probe#probe_}"
        else log "${probe#probe_}: unhealthy"; bad=1; fi
    done
    exit "$bad"
fi

# Check dependencies first. A database restart may temporarily interrupt Java;
# let it recover before deciding that Java needs a restart of its own.
if is_running askpool-postgres; then
    if ! watch_probe askpool-postgres probe_database PostgreSQL; then bad=1; fi
fi
if is_running hackathon-frontend-1; then
    if ! watch_probe hackathon-frontend-1 probe_frontend Frontend; then bad=1; fi
fi
if is_running hackathon-backend-1 && probe_database && probe_frontend; then
    if ! watch_probe hackathon-backend-1 probe_backend Backend; then bad=1; fi
fi
if is_running askpool-moderation-moderation-1; then
    if ! watch_probe askpool-moderation-moderation-1 probe_moderation Moderation; then bad=1; fi
fi
exit "$bad"
