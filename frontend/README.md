# AskPool frontend

The Vite app in this folder serves both dashboards:

- `src/professor/` — professor dashboard and demo lecture data
- `src/student/` — student dashboard, components, and question client
- `server/student-api/` — local Node demo API for student questions
- `scripts/dev.mjs` — starts Vite and the demo API together

Run `npm ci` and `npm run dev` from this folder, then open
`http://localhost:5173`. The app uses a fictional identity in development by
default. Java is only needed for routes beyond the student demo API. To disable
the demo identity, set `ASKPOOL_DEMO_AUTH=false` in `.env.local`.

Use `npm run build`, `npm run lint`, and `npm run test:student-api` to check the
app. `npm run reset-data` restores `server/student-api/seed.json` and clears
local questions, votes, and reports. The current local state is kept in
`server/student-api/data/state.json`, which is Git-ignored.

Student questions use a local demo store. Professor questions and past lectures
are still mock data. The two dashboards do not yet share live lecture data.
Both dashboards use the same navigation panel. Past Lectures opens existing mock
lecture history for professors and a placeholder page for students.
