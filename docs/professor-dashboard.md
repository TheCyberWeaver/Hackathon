# Professor dashboard handoff

The professor demo lives at `/professor`, reached through the Professor button on the entry page. `frontend/src/App.tsx` loads `/api/me` before rendering the dashboard and passes the signed-in user as a prop. The restored PR #2 component uses Vite, React, TypeScript, and Tailwind CSS v4. Both Vite and Caddy serve `/professor` on reload through their SPA fallback.

## Files and data

- `frontend/src/professor/mockQuestions.ts` defines the `Question` type and 12 fixed fictional questions (9 open, 3 answered). All fields required by the UI are present. The `StudentN` values are demo identifiers, not verified identities.
- `frontend/src/professor/mockPastLectures.ts` contains two fictional previous lectures with a course name, date, Zurich-time slot, and three saved question-and-answer pairs each. They are static demo records, not persisted lecture history.
- `frontend/src/professor/ProfessorDashboard.tsx` owns rendering and in-memory state. The data module has no rendering or network logic.
- `frontend/server/student-api/` persists active demo lecture sessions and join codes. `frontend/src/professor/lectureSession.ts` caches the active lecture in browser local storage, scoped to the signed-in user ID, and can still read older timestamp-only demo sessions. The shared API is authoritative for newly created sessions.
- `frontend/src/lib/questionIntake.ts` shares the browser-local paused state between the professor controls and student composer. It updates other tabs in the same browser through storage events.

The component copies the mock question array on first render. Status changes and deletions update only that state, so a reload restores the initial questions. Question data has no persistence or backend request. To connect real data later, replace the initialization source and state mutations in the dashboard; keep the `Question` shape and sorting rule unless the product requirements change.

## Behavior

Open, Answered, and Deleted are derived from current state. A Sort by control applies to all three tabs: Most votes (the default, with older questions first on ties) or Time asked (newest first). ID breaks remaining ties. The flame decoration always marks the three most-voted open questions, even when sorting by time. The selected tab and sort mode stay selected after a status change. A question can be expanded independently to show its fictional author ID and a locally formatted submission time. Vote counts are display only.

With no active lecture, Current Lecture shows an empty state and a green Start lecture button. Clicking it navigates to `/professor/start`, where the professor chooses a fictional archive course or enters another course name. Back returns without starting a session. Confirming creates a server-backed demo session with a unique join code and opens `/professor/session`, showing a QR link, the code, and copy actions. The professor can then view questions and return to the invite screen from the active lecture. The active lecture header shows the selected course; it cannot be changed after starting. Older browser-local timestamp-only sessions still open but have no join code until the professor creates one. End lecture invalidates the code on the server and clears browser-local controls. The server-backed session survives reloads and can be joined from other devices, but the current professor question cards are still mock data and do not share live questions with the student demo API.

The active lecture has Pause questions and End lecture in one controls row. Pausing disables and grays out the student question composer in the same browser; resuming re-enables it. Starting or ending a lecture clears the paused state. This is a frontend demo state only: other browsers and devices do not receive it, and the question API does not enforce it. The backend will need to publish the lecture's intake state and reject submissions while paused.

Deletion uses a native modal dialog. Cancel, Escape, or backdrop click preserves the question and returns focus to its Delete button. Confirmation removes the question and focuses the selected tab. The navigation button in the header opens the shared side panel with Current Lecture, Past Lectures, a profile card with email, Settings, and Log out. The panel closes with its button, Escape, or a backdrop click, then returns focus to the header button. The same panel is used in the student dashboard; its component and styles live in `frontend/src/components/`.

## Local checks

From `frontend/`, run `npm run lint` and `npm run build`. Run `npm run dev`, then choose Professor at `http://localhost:5173`. Development uses a sample identity without Java; production requires managed-proxy identity headers. Choosing Professor is demo navigation and does not assign privileged backend permissions.
