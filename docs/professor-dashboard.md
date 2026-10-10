# Professor dashboard handoff

The professor demo lives at `/professor`. This checkout uses Vite, React, TypeScript, and Tailwind CSS v4; it is not currently a Next.js app. `frontend/src/main.tsx` selects the professor page for that path and leaves the existing root page in place. Vite serves `/professor` directly during development and preview through its SPA fallback.

## Files and data

- `frontend/src/professor/mockQuestions.ts` defines the `Question` type and 12 fixed fictional questions (9 open, 3 answered). All fields required by the UI are present. The `StudentN` values are demo identifiers, not verified identities.
- `frontend/src/professor/ProfessorDashboard.tsx` owns rendering and in-memory state. The data module has no rendering or network logic.

The component copies the mock array on first render. Status changes and deletions update only that state, so a reload restores the initial questions. There is no persistence or backend request. To connect real data later, replace the initialization source and state mutations in the dashboard; keep the `Question` shape and sorting rule unless the product requirements change.

## Behavior

Open and Answered are derived from current state, then sorted by votes descending, submission time ascending, and ID ascending. The selected tab stays selected after a status change. A question can be expanded independently to show its fictional author ID and a locally formatted submission time. Vote counts are display only.

Deletion uses a native modal dialog. Cancel, Escape, or backdrop click preserves the question and returns focus to its Delete button. Confirmation removes the question and focuses the selected tab. The ASKPOOL button in the header opens a left navigation drawer with the Professor profile and inert Profile and Settings placeholders. The drawer closes with its button, Escape, or a backdrop click, then returns focus to the header button.

## Local checks

From `frontend/`, run `npm run lint`, `npx tsc -b`, and `npm run build`. Open `http://localhost:5173/professor` after `npm run dev` to inspect the demo. No student page, backend endpoint, authentication, or shared style was added for this feature.
