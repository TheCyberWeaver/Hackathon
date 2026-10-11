# Local development

Install JDK 21 and Node.js 20.19+, 22.13+, or 24+. From the repository root on Windows, run:

```powershell
.\dev-local.ps1
```

Wait for `Started LocalApplication`, then open <http://localhost:5173>. Use `-SkipInstall` after the first run. The script starts Vite, Java, and a real PostgreSQL instance on loopback; it never connects to the VM. Flyway creates or upgrades the schema automatically. Ctrl+C stops the services, while data remains in ignored `backend/.local-postgres/`.

The VS Code **Dev: start both** task also starts this local database. Stop those tasks before running `dev-local.ps1`. Alternatively, run `./gradlew.bat localRun` from `backend/` and `npm run dev` from `frontend/`. The **Backend: external database** task requires a separate PostgreSQL server.

## Identity and app behavior

Vite provides a demo identity locally. Set `ASKPOOL_DEMO_USER_ID` and optionally `ASKPOOL_DEMO_USER_NAME` in `frontend/.env.local`, then restart Vite to test another account. Both dashboards use the same account; each account has its own professor profile, courses, created lectures, and visited-lecture history. Only a lecture's creator can manage it or see question authors. A student can submit multiple questions and delete their own; self-voting is rejected.

In production, the managed login proxy supplies trusted `X-User-Id` and `X-User-Name` headers. To use that proxy during development, set `ASKPOOL_DEMO_AUTH=false`. Keep Java inaccessible to clients except through the managed proxy. See [API and permissions](API.md).

Start a lecture to display its six-character hexadecimal invitation code or QR link. Joining records a personal history entry. Pausing blocks new submissions; ending preserves existing questions for review. Removing an item from student history affects only that account.

## Local database

Keep the local app running to connect a SQL client:

| Setting | Value |
| --- | --- |
| Host/port | `127.0.0.1:55432` |
| Database/user | `askpool` / `askpool_app` |
| Password | empty |
| JDBC URL | `jdbc:postgresql://127.0.0.1:55432/askpool` |

This loopback-only development database uses trust authentication. Run `SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;` to inspect migrations. Change ports with `-DatabasePort`, `-BackendPort`, and `-FrontendPort`, for example:

```powershell
.\dev-local.ps1 -SkipInstall -DatabasePort 55433 -BackendPort 18081 -FrontendPort 5175
```

## Checks

From `backend/`, run `./gradlew.bat test bootJar` (or `./gradlew test bootJar` on Unix). Tests start a disposable PostgreSQL instance and do not alter the persistent local database. From `frontend/`, run `npm run test:api`, `npm run test:course-history`, `npm run build`, and `npm run lint`. For browser tests, see [frontend instructions](../frontend/README.md).

For an optional Docker database, set `DATABASE_PASSWORD` and start `docker compose -f backend/compose.local.yaml up -d`; then use the external-database backend task. Its default port is 5432, separate from the local runner on 55432.
