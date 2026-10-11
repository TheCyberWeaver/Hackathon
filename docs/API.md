# AskPool API

The frontend and Java backend share this contract. When a route changes, update the frontend adapters in `frontend/src/lib/poolApi.ts`, `frontend/src/student/lib/studentApi.ts`, and `frontend/src/professor/professorApi.ts` in the same release. Java wire records are in `backend/src/main/java/com/example/backend/pool/ApiModels.java`.

All routes below are under `/api`. The managed login proxy must replace client-supplied `X-User-Id` with the authenticated identity and keep Java inaccessible directly. `GET /api/me` also uses percent-encoded `X-User-Name` and returns `{ "id": "...", "name": "..." }`. Missing identity returns 401. Both dashboards use the same account; `users.role` does not change permissions. Responses containing pool or identity data use `Cache-Control: no-store`. JSON IDs are decimal strings so JavaScript does not lose BIGINT precision; timestamps are ISO 8601 with an offset.

## Lectures and personal history

| Method | Route | Result or body |
| --- | --- | --- |
| `GET` | `/lectures` | Lectures owned by, visited by, or currently joined by the caller. |
| `GET` | `/lectures/{id}` | Lecture details for a signed-in caller. |
| `POST` | `/lectures` | Create with `{ "title": "Algorithms", "lectureTime": "2026-10-10T10:00:00Z", "courseId": "optional-id" }`; 201. An optional `course` label supports legacy clients. |
| `PATCH` | `/lectures/{id}/session` | Owner action `{ "action": "start" }`, `pause`, `resume`, or `end`. |
| `DELETE` | `/lectures/{id}` | Owner deletes a completed lecture; 204. |
| `POST` | `/sessions/join` | Select an active lecture with `{ "code": "A3F19C" }`; returns its shared session. |
| `GET`, `DELETE` | `/sessions/mine` | Read or leave the caller's current session. |
| `GET` | `/student/lectures/history` | Caller-only visited lectures, most recent first. |
| `POST` | `/lectures/{id}/visits` | Record this caller's visit and return the lecture. |
| `POST` | `/lectures/by-code/{code}/visits` | Resolve an invitation code and record a visit, including after the session ends. |
| `DELETE` | `/student/lectures/history/{id}` | Remove only the caller's history entry; 204. |

Lecture responses include `id`, `joinCode`, `title`, `lectureTime`, `canManage`, `course`, `startedAt`, `endedAt`, `questionsPaused`, `courseKey`, `courseName`, and `courseArchived`. `canManage` is true only for the creator. Codes contain exactly six hex characters (0–9, A–F), are case-insensitive on input, and are separate from numeric internal IDs. New lectures are scheduled until started; paused or ended lectures reject new submissions with 409. Ended lectures cannot restart. Visiting a lecture or joining records personal history; reading a question or history list does not recreate a removed entry.

## Questions

| Method | Route | Result or body |
| --- | --- | --- |
| `GET` | `/lectures/{id}/questions` | Public-to-signed-in question list. |
| `GET` | `/lectures/{id}/questions/{questionId}` | One question. |
| `POST` | `/lectures/{id}/questions` | `{ "text": "Why does this work?" }`; 1–200 trimmed characters; 201. |
| `POST` | `/questions/{id}/vote` | `{ "voted": true }` or `false`; toggles the caller's vote. |
| `POST` | `/questions/{id}/report` | Record caller's report; 204. |
| `DELETE` | `/questions/{id}` | Question author or lecture owner deletes permanently; 204. |
| `GET` | `/lectures/{id}/professor/questions` | Owner-only questions with authors and report counts. |
| `PATCH` | `/questions/{id}/status` | Owner sets `{ "status": "open" }`, `selected`, or `answered`. |
| `POST` | `/lectures/{id}/questions/clear-open` | Owner sends `{ "questionIds": ["42", "43"] }`, the confirmed Open snapshot; returns `{ "deletedIds": [...] }`. |

Student-facing `Question` responses contain `id`, `text`, `votes`, `createdAt`, `status`, `mine`, and `votedByMe`; they never contain an author ID or reports. `mine` is specific to the caller. Owner-only `ProfessorQuestion` adds `authorId`, `upvoteCount`, `answered`, `answeredAt`, and `reportCount`. Questions rank by vote count descending, then submission time and ID ascending, with answered questions last. Multiple submissions per lecture are allowed; a user cannot vote for their own question. Deletion also removes its votes and reports. Clearing Open deletes only listed questions still unanswered in that lecture, leaving later submissions and answered questions intact.

Java checks the bundled sensitive-word list on every submission. If `MODERATION_URL` is configured, it additionally calls the moderation service. Rejected text returns 422 and is not saved. An unavailable optional service does not block submission.

## Profiles and summaries

| Method | Route | Result or body |
| --- | --- | --- |
| `GET`, `POST /initialize`, `PUT` | `/professor/profile` | Read, initialize, or save the caller's profile and ordered courses. |
| `GET` | `/professor/summary` | Counts for caller-owned lectures. |
| `GET` | `/student/summary` | `{ "submittedCount": 5, "answeredCount": 2 }` for caller-authored remaining questions. |
| `GET` | `/professor/lectures/archive` | Caller-owned ended lectures and their questions. |

Profile writes take `onboardingCompleted` and an ordered `courses` array of `{ "id": "...", "title": "..." }`; `PUT` also requires the last read `revision`. A stale revision returns 409. Course IDs persist through edits, and removed courses are archived. A removed ID cannot be reused; create a new ID even when reusing a title. `historyKey` on active profile courses and `courseKey` on lectures support course-grouped history. See [database state](Database_State.md).

Errors normally have `{ "error": "Human-readable message." }`: 400 invalid input, 401 missing identity, 403 forbidden operation, 404 missing or inaccessible resource, 409 conflicting state, and 422 moderation rejection. `GET /api/hello` remains an unauthenticated health/sample endpoint.
