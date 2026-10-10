# VIScon deployment

The app runs from `/home/viscon/hackathon` on SSH host `viscon-2026`.
The portal at https://08.hackathon.ethz.ch handles TLS and login and forwards
HTTP to port 8080. Caddy serves the production frontend and proxies `/api/*`
to the Java 21 backend. Student question requests go to the existing Node demo
API, whose state persists in the `hackathon_student-data` Docker volume. All
containers restart automatically. The professor dashboard retains its mock data.

## Build and package (PowerShell, repository root)

Use JDK 21 with `JAVA_HOME` pointing to the JDK root directory.

```powershell
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend run lint
$env:GRADLE_USER_HOME = "$PWD/.gradle-user-home"
Push-Location backend
.\gradlew.bat test bootJar --no-daemon
Pop-Location
New-Item -ItemType Directory -Force deploy/artifacts/frontend | Out-Null
Copy-Item backend/build/libs/backend-0.0.1-SNAPSHOT.jar deploy/artifacts/backend.jar
Copy-Item frontend/dist/* deploy/artifacts/frontend -Recurse -Force
New-Item -ItemType Directory -Force deploy/artifacts/student-api | Out-Null
Copy-Item frontend/student-frontend/server/*.mjs, frontend/student-frontend/server/seed.json deploy/artifacts/student-api
tar -czf backend/build/viscon-deploy.tar.gz -C deploy compose.yaml Caddyfile artifacts
scp backend/build/viscon-deploy.tar.gz viscon-2026:~/
```

For subsequent deployments, build into a fresh artifacts directory to avoid
retaining obsolete frontend assets. Transfer only build outputs and deployment
configuration; credentials are not part of the bundle.

## Run (on the VM)

```bash
mkdir -p ~/hackathon
tar -xzf ~/viscon-deploy.tar.gz -C ~/hackathon
cd ~/hackathon
docker compose -p hackathon pull
docker compose -p hackathon up -d
curl --fail http://localhost:8080/
curl --fail http://localhost:8080/api/hello
```

The API should return `{"message":"Hello from Java 21"}`.
Inspect status and logs with `docker compose -p hackathon ps` and
`docker compose -p hackathon logs --tail 100`.

Before replacing the supplied demo, run with `HTTP_PORT=18080` and verify both
URLs at that port. Then stop `template-frontend-1` and `template-backend-1`,
and run `docker compose -p hackathon up -d` again without `HTTP_PORT`.
The original demo files and containers remain available.

## Roll back to the supplied demo

```bash
cd ~/hackathon
docker compose -p hackathon down
docker start template-backend-1 template-frontend-1
```

## cmd - auto deployment
powershell.exe -NoProfile -ExecutionPolicy Bypass -File E:\Hackathon\deploy-local.ps1
