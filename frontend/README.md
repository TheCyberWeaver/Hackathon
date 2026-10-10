# AskPool frontend

Both dashboards use the Java PostgreSQL API. Shared transport and lecture models live in `src/lib/poolApi.ts`; student/professor adapters define their question contracts. See [API docs](../docs/API.md).

Run `npm ci`, then `npm run dev`. Start Java on port 8080 with PostgreSQL configured. Vite proxies all API routes to Java and injects a fictional student identity in development. Disable with `ASKPOOL_DEMO_AUTH=false` in `.env.local` when using managed login. Professor rights must be assigned in the database even locally.

Professors create lectures and share `/student?lecture=<id>` links. Students select lectures, submit one question per lecture, vote, and report. Professors see authors/reports, select, answer, reopen, and hide questions. Both dashboards refresh every five seconds. The professor archive opens persisted pools; written answers and QR images are not implemented. Both lecture archives open saved question pools.

Run `npm run build`, `npm run lint`, and `npm run test:api`. The client tests
cover lecture routes, proxy identity, shared transport, errors, and no-content
responses. `server/student-api/` and the `test:student-api`/`reset-data` scripts
remain legacy fixtures; neither dashboard uses them, and development no longer
starts Node API.
