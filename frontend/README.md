# AskPool frontend

Both dashboards use the Java PostgreSQL API. Shared transport and lecture models live in `src/lib/poolApi.ts`; student/professor adapters define their question contracts. See [API docs](../docs/API.md).

For a persistent local database without Docker or a VM, run `./dev-local.ps1`
from the repository root. See [local setup](../docs/Local_Development.md).

Run `npm ci`, then `npm run dev`. Start Java on port 8080 with PostgreSQL configured. Vite proxies all API routes to Java and injects a fictional student identity in development. Disable with `ASKPOOL_DEMO_AUTH=false` in `.env.local` when using managed login. Set `APP_TESTING_PERMISSIONS=true` in the Java terminal to let the same identity use every role; the VM deployment enables this testing mode by default. When disabled, professor rights must be assigned in the database.

Professors choose or create a lecture, start it, then share a generated join code or QR link. Students enter the code or scan the QR to join; Leave lecture returns them to the code-entry page. Lecture membership and codes are persisted by Java/PostgreSQL. Students can submit multiple questions, vote, and report. Professors see authors/reports, select, answer, reopen, and hide questions. Both dashboards refresh lecture and question data. The professor archive opens persisted pools with written answers.

Run `npm run build`, `npm run lint`, and `npm run test:api`. The client tests
cover lecture routes, proxy identity, shared transport, errors, and no-content
responses. `server/student-api/` and the `test:student-api`/`reset-data` scripts
remain legacy fixtures; neither dashboard uses them, and development no longer
starts Node API.
