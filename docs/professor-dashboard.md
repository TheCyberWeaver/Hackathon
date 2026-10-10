# Professor dashboard handoff

The professor demo lives at `/professor`, with a Past Lectures view at `/professor/past-lectures` and profile and settings views at `/professor/profile` and `/professor/settings`. This checkout uses Vite, React, TypeScript, and Tailwind CSS v4; it is not currently a Next.js app. `frontend/src/main.tsx` selects the professor area for those paths and leaves the existing root page in place. Vite serves them directly during development and preview through its SPA fallback.

## Files and data

- `frontend/src/professor/mockQuestions.ts` defines the `Question` type and 12 fixed fictional questions (9 open, 3 answered). All fields required by the UI are present. The `StudentN` values are demo identifiers, not verified identities.
- `frontend/src/professor/mockPastLectures.ts` contains two fictional previous lectures with three saved question-and-answer pairs each. They are static demo records, not persisted lecture history.
- `frontend/src/professor/ProfessorDashboard.tsx` owns rendering and in-memory state. The data module has no rendering or network logic.

The component copies the mock array on first render. Status changes and deletions update only that state, so a reload restores the initial questions. There is no persistence or backend request. To connect real data later, replace the initialization source and state mutations in the dashboard; keep the `Question` shape and sorting rule unless the product requirements change.

## Behavior

Open and Answered are derived from current state, then sorted by votes descending, submission time ascending, and ID ascending. The selected tab stays selected after a status change. A question can be expanded independently to show its fictional author ID and a locally formatted submission time. Vote counts are display only.

Deletion uses a native modal dialog. Cancel, Escape, or backdrop click preserves the question and returns focus to its Delete button. Confirmation removes the question and focuses the selected tab. The ASKPOOL button in the header opens a left navigation drawer. Current Lecture and Past Lectures are the top navigation items; Past Lectures shows an expandable mock archive with questions and written answers. It does not yet save changes from the current lecture. The profile card and adjacent gear at the bottom open Profile and Settings. The drawer closes with its button, Escape, or a backdrop click, then returns focus to the header button. Profile shows the fictional demo name Alex Morgan. Settings shows a clearly labeled terms placeholder. Log out sits beneath the profile card and returns to the root starter page; there is no authentication or server session to end yet.

## Local checks

From `frontend/`, run `npm run lint`, `npx tsc -b`, and `npm run build`. Open `http://localhost:5173/professor` after `npm run dev` to inspect the demo. No student page, backend endpoint, authentication, or shared style was added for this feature.
