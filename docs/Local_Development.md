# Test AskPool locally without deploying

## Windows: one command, no Docker required

Install Java JDK 21 and Node.js, then run from the repository root:

```powershell
.\dev-local.ps1
```

The script installs frontend dependencies if needed, builds the local Java
runner, and starts PostgreSQL, Java, and Vite. Wait for `Started LocalApplication`,
then open [the local app](http://localhost:5173). Later runs can reuse dependencies:

```powershell
.\dev-local.ps1 -SkipInstall
```

PostgreSQL binaries come from the existing embedded-postgres dependency. This is
a real PostgreSQL server, with the same Flyway schema migrations as the VM.
It binds to loopback, uses a separate database, and never connects to the VM.
The local Java runtime is excluded from the production JAR.

Vite supplies a demo identity. Every signed-in user can create lectures in Professor and join lectures in Student using the same account. Only a lecture's creator can manage it or see its professor archive. Student history is stored per identity and survives leaving or ending a session; removing an entry changes only that user's list. Students can submit multiple questions and delete their own questions. Self-voting is disabled.

To test a second account, change `ASKPOOL_DEMO_USER_ID` in `frontend/.env.local` and restart the local app. Each account has its own professor courses, created lectures, summary and student history. Existing `APP_TESTING_PERMISSIONS` settings no longer bypass ownership.

Start a lecture before students join using its numeric code or room link. Pause and resume control submissions; ending preserves the question pool for history review. Question deletion is permanent. Professor histories show created lectures, while student histories show visited lectures.

## Connect a SQL client

Keep the local app running and use these settings:

| Setting  | Value                                         |
| -------- | --------------------------------------------- |
| Host     | `127.0.0.1`                                   |
| Port     | `55432`                                       |
| Database | `askpool`                                     |
| User     | `askpool_app`                                 |
| Password | Empty                                         |
| SSL      | Disabled for this loopback development server |
| JDBC URL | `jdbc:postgresql://127.0.0.1:55432/askpool`   |

Local access uses PostgreSQL trust authentication on loopback. This connection
is for the local development database only. Example read-only checks:

```sql
SELECT id, title, lecture_time FROM lectures ORDER BY id DESC;
SELECT id, lecture_id, text, status, submitted_at FROM questions ORDER BY id DESC;
SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;
```

Database files are retained in `backend/.local-postgres/` and excluded from Git.
Ctrl+C stops the local app. Starting it again restores lectures, questions,
votes, and reports. Only Flyway-managed changes should alter the application
schema; avoid manually creating its tables before first startup.

If a port is occupied, stop the existing service or choose three alternate ports:

```powershell
.\dev-local.ps1 -SkipInstall -DatabasePort 55433 -BackendPort 18081 -FrontendPort 5175
```

The local runner overrides inherited VM database settings, and the script directs
Vite to its chosen backend port. Vite output is in `backend/build/local/vite.log`
and `vite-error.log`; Java/PostgreSQL output appears in the terminal.

## Run the backend without the Windows launcher

In VS Code, run **Terminal → Run Task → Dev: start both**. Its **Backend: dev**
task uses `localRun`, so PostgreSQL starts automatically on port 55432 before
Java starts on port 8080. Wait for `Started LocalApplication`, then open
http://localhost:5173. Stop both development tasks before using `dev-local.ps1`.

**Backend: external database** and **Debug backend (external database)** use
the ordinary application and require an already running PostgreSQL database
(port 5432 by default). A connection-refused error on 5432 means that external
database is unavailable; use **Backend: dev** for the automatic local database.

From `backend/`, run `./gradlew localRun` (Windows: `./gradlew.bat localRun`).
In another terminal, run `npm run dev` from `frontend/`. This uses the same
persistent database on port 55432 and Java on port 8080. Java must be JDK 21.

Both `http://localhost:5173` and `http://127.0.0.1:5173` are allowed locally,
including the VS Code browser preview. Restart Java after updating the CORS
configuration. With normal backend startup, `APP_FRONTEND_ORIGIN` accepts a
comma-separated list of exact origins; the deployment sets its public frontend
origin. The isolated `localRun` task instead uses the local origins above, and
`dev-local.ps1` adjusts both origins to its configured frontend port.

## Automated database tests

From `backend/`, run `./gradlew test` (Windows: `./gradlew.bat test`). Tests use
a separate disposable PostgreSQL instance; they do not modify your persistent
local database or the VM. From `frontend/`, run `npm run test:api`, `npm run build`,
and `npm run lint`. Client tests cover automatic lecture discovery, cleanup,
request failures, and API contracts.

## Optional Docker database

If you prefer Docker, `backend/compose.local.yaml` is still available. Set
`DATABASE_PASSWORD`, start it with `docker compose -f backend/compose.local.yaml up -d`,
and run the ordinary backend `bootRun` with that password and local port 5432.
This is a separate database from the embedded runner; use one backend setup at a
time. Both dashboards are available to every signed-in account.
