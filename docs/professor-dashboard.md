# Professor dashboard handoff

The professor demo lives at `/professor`, reached through the Professor button on the entry page. `frontend/src/App.tsx` loads `/api/me` before rendering the dashboard and passes the signed-in user as a prop. The restored PR #2 component uses Vite, React, TypeScript, and Tailwind CSS v4. Both Vite and Caddy serve `/professor` on reload through their SPA fallback.

## Files and data

- `frontend/src/professor/mockQuestions.ts` defines the `Question` type and 12 fixed fictional questions (9 open, 3 answered). All fields required by the UI are present. The `StudentN` values are demo identifiers, not verified identities.
- `frontend/src/professor/mockPastLectures.ts` contains two fictional previous lectures with three saved question-and-answer pairs each. They are static demo records, not persisted lecture history.
- `frontend/src/professor/ProfessorDashboard.tsx` owns rendering and in-memory state. The data module has no rendering or network logic.

The component copies the mock array on first render. Status changes and deletions update only that state, so a reload restores the initial questions. There is no persistence or backend request. To connect real data later, replace the initialization source and state mutations in the dashboard; keep the `Question` shape and sorting rule unless the product requirements change.

## Behavior

Open and Answered are derived from current state, then sorted by votes descending, submission time ascending, and ID ascending. The selected tab stays selected after a status change. A question can be expanded independently to show its fictional author ID and a locally formatted submission time. Vote counts are display only.

Deletion uses a native modal dialog. Cancel, Escape, or backdrop click preserves the question and returns focus to its Delete button. Confirmation removes the question and focuses the selected tab. The navigation button in the header opens the shared side panel with Current Lecture, Past Lectures, a profile card with email, Settings, and Log out. The panel closes with its button, Escape, or a backdrop click, then returns focus to the header button. The same panel is used in the student dashboard; its component and styles live in `frontend/src/components/`.

## Local checks

From `frontend/`, run `npm run lint` and `npm run build`. Run `npm run dev`, then choose Professor at `http://localhost:5173`. Development uses a sample identity without Java; production requires managed-proxy identity headers. Choosing Professor is demo navigation and does not assign privileged backend permissions.
