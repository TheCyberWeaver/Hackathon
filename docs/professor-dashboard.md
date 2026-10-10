# Professor dashboard

The merged dashboard uses the Java API through `frontend/src/professor/professorApi.ts` and the shared transport. Mock question/archive data and browser-local session controls have been replaced with PostgreSQL records.

Choose or create a lecture with a title and optional course on the separate start page, then start it. The invite page displays a saved join code and QR link; Go to questions opens the live pool. The active dashboard has Show join code, not a course switcher. Start, pause, resume, and end are shared across browsers. Pausing disables the student composer and the API rejects new submissions. Ending expires the join code and preserves the question pool in Past Lectures.

Open, Answered, and Deleted tabs use saved status and deletion timestamps. Sort by most votes (earlier questions first on ties) or newest first; ID resolves remaining ties. The top-three decoration continues to use vote ranking regardless of display sort. Cards display question text, votes, and submission time without student names. Expanded cards show report counts and an optional written-answer editor. Marking unanswered clears the saved answer and answer timestamp.

Moving a question to Deleted keeps its status, answer, votes, and reports. Restore returns it to Open or Answered. Permanent deletion and Delete all remove only already-deleted questions, with dependent votes and reports. The dialog preserves the incoming cancel/Escape/focus behavior, and mutations are confirmed by the API before state changes. Students may also hide their own questions.

Past Lectures uses the persisted ended-session archive, including unanswered questions and saved written answers. Profile uses the signed-in user's name and server counts across manageable lecture pools, excluding Deleted. Polling refreshes the active lecture, questions, archive, and profile data every five seconds as applicable.

Normal mode permits only lecture owners/admins to manage sessions, read private moderation data, restore, and purge. Existing hackathon testing permissions continue to allow all signed-in accounts to manage pools; they still cannot submit to scheduled/paused/ended lectures or vote for themselves. See [the API contract](API.md).

Verify with frontend `npm run test:api`, `npm run build`, and `npm run lint`, and backend `./gradlew test bootJar`. Unit tests cover session transitions and ownership rules; PostgreSQL-backed tests cover lifecycle persistence, intake races, archive retention, written answers, counts, restore, scoped purging, privacy, and legacy schema adoption. See [local development](Local_Development.md) for the no-Docker runner.
