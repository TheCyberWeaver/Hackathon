#!/usr/bin/env bash
# Install as the VM deployment user; no root access or host package changes.
set -Eeuo pipefail
umask 077

source_script="${1:?Pass the uploaded askpool-watchdog.sh path}"
test -s "$source_script"
command -v crontab >/dev/null
command -v docker >/dev/null
command -v flock >/dev/null
command -v logger >/dev/null
command -v curl >/dev/null
command -v timeout >/dev/null

mkdir -p "$HOME/askpool-recovery"
install -m 700 "$source_script" "$HOME/askpool-recovery/watchdog.sh"

web_release=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' hackathon-frontend-1)
test -f "$web_release/compose.yaml"
ln -sfn "$web_release" "$HOME/hackathon-current"

bash -n "$HOME/askpool-recovery/watchdog.sh"
"$HOME/askpool-recovery/watchdog.sh" check

cron_line="* * * * * $HOME/askpool-recovery/watchdog.sh watch >/dev/null 2>&1 # askpool-watchdog"
{ crontab -l 2>/dev/null | grep -v '# askpool-watchdog' || true; printf '%s\n' "$cron_line"; } | crontab -
crontab -l | grep -F '# askpool-watchdog'
echo 'AskPool recovery installed and active.'
