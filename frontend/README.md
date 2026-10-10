# AskPool frontend

The Vite app in this folder serves both dashboards:

- `src/professor/` — professor dashboard and demo lecture data
- `src/student/` — student dashboard, components, and question client
- `server/student-api/` — local Node demo API for student questions and lecture join codes
- `scripts/dev.mjs` — starts Vite and the demo API together

Run `npm ci` and `npm run dev` from this folder, then open
`http://localhost:5173`. The app uses a fictional identity in development by
default. Java is only needed for routes beyond the student demo API. To disable
the demo identity, set `ASKPOOL_DEMO_AUTH=false` in `.env.local`.

Use `npm run build`, `npm run lint`, and `npm run test:student-api` to check the
app. `npm run reset-data` restores `server/student-api/seed.json` and clears
local questions, votes, reports, and lecture sessions. The current local state is kept in
`server/student-api/data/state.json`, which is Git-ignored.

After selecting a course, professors get a join code and QR link. Students enter
the code, scan the QR in-app, or open its link to join. The Node API validates
codes and persists membership; students can leave without ending the lecture,
and ending the lecture invalidates the code.
Student questions use the local demo store, while professor question cards and
past lectures are still mock data. The two dashboards do not yet share live
question data or isolate questions by lecture.
Both dashboards use the same navigation panel. Past Lectures opens existing mock
lecture history for professors and a placeholder page for students.
