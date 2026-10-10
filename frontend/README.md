# AskPool frontend

Both dashboards use the Java PostgreSQL API. Shared transport and lecture models live in `src/lib/poolApi.ts`; student/professor adapters define their question contracts. See [API docs](../docs/API.md).

For a persistent local database without Docker or a VM, run `./dev-local.ps1`
from the repository root. See [local setup](../docs/Local_Development.md).

Run `npm ci`, then `npm run dev`. Start Java on port 8080 with PostgreSQL configured. Vite proxies all API routes to Java and injects a fictional student identity in development. Disable with `ASKPOOL_DEMO_AUTH=false` in `.env.local` when using managed login. Every signed-in identity can use Student and Professor; lecture management and professor history belong only to its creator. Student history records that account's visits. Change `ASKPOOL_DEMO_USER_ID` to test another account.

Professors manage a database-backed course list in onboarding, Settings and the chooser. Skip works with no courses; adding a course saves it without starting a session. Explicitly starting a lecture preserves the course name for its lifetime, then shows its numeric lecture ID and QR link. Students enter the ID or scan the QR to select an active lecture; Leave lecture returns them to the code-entry page. Java/PostgreSQL stores one selected lecture per signed-in student, so it reappears on another device. Question endpoints do not enforce enrollment. Students can submit multiple questions, vote, and report. Professors mark questions verbally answered, reopen them, and permanently delete individual questions or all confirmed Open questions. A moving time filter affects only their Open view. Students see their own questions separately and cannot self-vote. Both dashboards refresh lecture and question data. Compact lecture history shows text and status, with no written answers.

Run `npm run build`, `npm run lint`, and `npm run test:api`. The client tests
cover lecture routes, proxy identity, shared transport, errors, and no-content
responses. `server/student-api/` and the `test:student-api`/`reset-data` scripts
remain legacy fixtures; neither dashboard uses them, and development no longer
starts Node API.

## Product acceptance tests

Run `npm run test:professor-profile` for migration-input validation, profile transport, chooser and moving-window ranking tests. Run `npm run test:e2e` for real desktop/mobile Chromium interactions and independent browser contexts against Java and a fresh embedded PostgreSQL database.

Before browser tests, build the local Java classpath with `./gradlew.bat writeLocalClasspath` from the backend directory (or `./gradlew writeLocalClasspath` on Unix), using JDK 21. Set `JAVA_HOME` to that JDK. The browser tests default to installed Chrome; set `PLAYWRIGHT_CHANNEL=msedge` for Edge. Test-only servers use loopback ports 5186 and 8086 plus an automatically assigned PostgreSQL port; do not run another service there. Test data/logs stay under `backend/build/e2e/`, screenshots and failure traces under `frontend/test-results/`. Existing local app/database processes are not reused.

The browser suite covers skip, saving failures, inline course creation, explicit session start, same-account persistence, account separation, stale updates, reordering, student ownership and self-vote feedback, moving filters, clear cancellation and scope, course edits preserving lectures, and collapsed archive status. Backend tests additionally verify permanent deletion cascades, later-submission boundaries, authorization and upgrading existing answer/trash records.
