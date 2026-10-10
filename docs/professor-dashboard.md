# Professor dashboard integration

The dashboard at `/professor` receives identity from `/api/me` and uses Java/PostgreSQL for all lecture pools. `professorApi.ts` defines wire models and operations; `ProfessorDashboard.tsx` renders them. Old mock files remain unused fixtures.

A database professor role is required to create lectures. Only the lecture owner or an admin can fetch authors/report counts, select questions, answer/reopen them, or hide them. Changing the dashboard does not elevate an account. See [API contract](API.md) and [database setup](../deploy/README.md).

The lecture picker supports creation and student join links. Open/Answered tabs sort by votes descending, submission time ascending, then ID. Questions expand to show real authors, status, report count, and submission time. The pool refreshes every five seconds. Mutations are confirmed by the API before local state is updated. Deletion hides content and preserves attribution, votes, and reports. Students can also delete their own questions.

Past Lectures opens persisted lecture pools. Answer status is stored; written answer text is not part of the current schema. The profile displays the signed-in user's name. Both dashboards use the shared navigation panel.

Run frontend `npm run build` and `npm run lint`, and backend `./gradlew test bootJar`. Local development needs Java/PostgreSQL and an explicitly assigned professor role for the Vite demo identity.
