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

Vite supplies the demo identity and all signed-in users have testing permissions,
so you can create a lecture in the professor dashboard and submit a question in
the student dashboard using the same account. Students can submit multiple
questions per lecture and delete their own questions. Self-voting is still disabled.
To test another identity, change
`ASKPOOL_DEMO_USER_ID` in `frontend/.env.local` and restart the local app.

New lectures appear in both dashboards' selectors within five seconds, and the
list refreshes when the browser regains focus. A chosen lecture stays selected.
The first lecture is automatically selected when an initially empty list fills.

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
time. Set `APP_TESTING_PERMISSIONS=true` in that Java terminal for both dashboards.
