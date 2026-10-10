# VIScon deployment

The managed address https://08.hackathon.ethz.ch handles TLS and login and
forwards HTTP to VM port 8080. Caddy serves the single built frontend containing
the entry page and both dashboards. It forwards `/api/me` and other Java routes
to the Java 21 backend, and `/api/questions` routes to the Node student API.
Student questions persist in the `hackathon_student-data` Docker volume.
The professor dashboard retains its mock data. Keep the managed login enabled;
the backend and student API have no published host ports.

## Automatic deployment from this Windows machine

The local `deploy-local.ps1` at the repository root is ignored by Git. It contains
the temporary VM password and resolves `viscon-2026` through the existing
OpenSSH configuration. The password is used for automatic SSH/SFTP login and
is excluded from uploaded bundles. The script verifies the VM's existing key
in `%USERPROFILE%\.ssh\known_hosts`.

Prerequisites: Node.js, JDK 21, Windows OpenSSH, `tar.exe`, and Python 3.10+.
The script prepares Paramiko 4.0.0 automatically in an isolated environment at
`backend/build/deploy-tools/`; no global Python package installation is needed.

Run from any directory:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File E:\Hackathon\deploy-local.ps1
```

Optional checks:

```powershell
# Verify automatic VM login and Docker prerequisites without deploying.
.\deploy-local.ps1 -CheckConnection

# Build, test, and package locally without connecting to the VM.
.\deploy-local.ps1 -BuildOnly

# Test a temporary VM candidate, then clean it up without switching production.
.\deploy-local.ps1 -ValidateOnly

# Reuse installed frontend dependencies, or select a JDK explicitly.
.\deploy-local.ps1 -BuildOnly -SkipInstall
.\deploy-local.ps1 -JdkPath 'C:\Program Files\Eclipse Adoptium\jdk-21.0.8.9-hotspot'
```

The script installs frontend dependencies, runs its build/lint/student API
tests, and runs Java tests plus `bootJar`. It packages a fresh directory with
`frontend/dist`, the Java JAR, and only `index.mjs`, `store.mjs`, and `seed.json`
from `frontend/server/student-api/`. Local student data, development identity,
credentials, and the obsolete nested student app are excluded.

## Rollout and rollback

Each upload is checksum-verified and extracted into
`/home/viscon/hackathon-releases/<release-id>`. A VM lock prevents overlapping
deployments. The candidate runs on `127.0.0.1:18080` with its own disposable
student-data volume. Checks cover the Java API, login name/ID, student API,
unauthenticated HTTP 401 responses, frontend assets, and both dashboard routes.

After those checks pass, the script recreates project `hackathon` on port 8080
and repeats the checks. Its existing student-data volume is preserved. Candidate
containers and volumes are removed. If switching fails, the script restores
the previous release; the supplied template containers are the first-release
fallback. Previous release directories remain available for rollback.

To inspect the current release on the VM:

```bash
release=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' hackathon-frontend-1)
docker compose -p hackathon -f "$release/compose.yaml" ps
docker compose -p hackathon -f "$release/compose.yaml" logs --tail 100
```

For a manual rollback, use the previous release directory printed by the script:

```bash
docker compose -p hackathon -f /home/viscon/hackathon-releases/<previous-release>/compose.yaml up -d --force-recreate --remove-orphans
```

Keep the production student volume when rolling back; do not pass `--volumes`
to a production `down` command.
