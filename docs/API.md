# AskPool Java API contract

This initial contract can evolve. Java wire records in `ApiModels.java` are separate from database columns. Update this document and the frontend adapters (`src/lib/poolApi.ts`, `src/student/lib/studentApi.ts`, `src/professor/professorApi.ts`) together. Breaking changes require a coordinated frontend release or versioned routes. The old Node list/create `/api/questions` routes are replaced by explicit lecture routes.

Every pool route requires the trusted proxy's `X-User-Id`. New identities become students. Permissions come from `users.role`, never a browser role or dashboard selection. Only a lecture's owner or an admin may view authors/report counts or moderate. Any authenticated user can view anonymous pools and report. The QR/code UI uses the lecture's numeric ID; Java persists each student's selected lecture. Question endpoints still do not enforce enrollment, so a lecture ID is not a private access token. Keep Java behind the managed login proxy with no public port.

For hackathon testing, the deployment enables `APP_TESTING_PERMISSIONS=true`.
Every signed-in account can then create/manage every lecture, submit questions,
vote, view authors/reports through the professor API, and moderate questions,
regardless of its stored role or lecture ownership. All lecture responses have
`canManage: true`, so both dashboards show the same available lectures. Database
roles remain unchanged. The table below describes restricted mode, restored with
`APP_TESTING_PERMISSIONS=false`. Sign-in, text validation, vote uniqueness,
and the self-vote restriction apply in both modes. Multiple questions per lecture are allowed.

IDs in JSON are decimal strings, avoiding JavaScript BIGINT precision loss. Times are ISO 8601 with an offset. Pool responses use `Cache-Control: no-store`.

| Method | Route                                       | Success                         | Permission                             |
| ------ | ------------------------------------------- | ------------------------------- | -------------------------------------- |
| GET    | `/api/lectures`                             | `Lecture[]`, newest time first  | Signed in                              |
| GET    | `/api/lectures/{id}`                        | `Lecture`                       | Signed in                              |
| POST   | `/api/lectures`                             | 201 `Lecture`, Location header  | Professor/admin                        |
| GET    | `/api/lectures/{id}/questions`              | `Question[]`                    | Signed in                              |
| GET    | `/api/lectures/{id}/questions/{questionId}` | `Question`                      | Signed in                              |
| POST   | `/api/lectures/{id}/questions`              | 201 `Question`, Location header | Student                                |
| POST   | `/api/questions/{id}/vote`                  | `Question`                      | Student, another author's question     |
| POST   | `/api/questions/{id}/report`                | 204                             | Signed in                              |
| GET    | `/api/lectures/{id}/professor/questions`    | `ProfessorQuestion[]`           | Owner/admin                            |
| PATCH  | `/api/questions/{id}/status`                | `ProfessorQuestion`             | Owner/admin                            |
| DELETE | `/api/questions/{id}`                       | 204                             | Question author or lecture owner/admin |

| Method | Additional route                          | Success                                     | Permission                                     |
| ------ | ----------------------------------------- | ------------------------------------------- | ---------------------------------------------- |
| PATCH  | `/api/lectures/{id}/session`              | Lecture                                     | Lecture owner/admin                            |
| GET    | `/api/professor/summary`                  | Counts                                      | Professor/admin, scoped to manageable lectures |
| GET    | `/api/professor/lectures/archive`         | Ended lectures and questions                | Professor/admin, scoped to manageable lectures |
| POST   | `/api/lectures/{id}/questions/clear-open` | `{ "deletedIds": string[] }`                | Lecture owner/admin                            |
| GET    | `/api/professor/profile`                  | Profile                                     | Professor/admin, own account only              |
| POST   | `/api/professor/profile/initialize`       | Profile                                     | Professor/admin, own account only              |
| PUT    | `/api/professor/profile`                  | Saved profile                               | Professor/admin, own account only              |
| POST   | `/api/sessions/join`                      | Active lecture ID, code, course, start time | Student, valid numeric lecture ID              |
| GET    | `/api/sessions/mine`                      | `{ "session": SharedSession or null }`      | Signed in                                      |
| DELETE | `/api/sessions/mine`                      | 204                                         | Signed in                                      |

New lectures are scheduled: create with `title`, `lectureTime`, and optional
`course` (up to 200 characters), then start with `{ "action": "start" }`.
Lecture responses include `course`, `startedAt`, `endedAt`, and
`questionsPaused`. Session actions also accept `pause`, `resume`, and `end`.
Start and end are idempotent and preserve their original timestamps. Ended
lectures cannot restart. Pausing/resuming/ending requires a started lecture.
Submissions to scheduled, paused, or ended lectures return 409, including in
testing-permission mode. Session updates and submissions lock the same lecture
row. Existing lecture pools are migrated as started sessions to preserve access.

Deleting a question permanently removes it and its dependent votes/reports. There is no trash or restore API. Archive and summary counts use remaining questions; empty ended lectures remain visible. V9 permanently removes old trash and drops the written-answer and soft-delete columns, preserving the other questions, votes and answered statuses. Deploy the backend migration and compatible frontend together; do not run the older backend against V9.

Clear Open accepts `{ "questionIds": ["42", "43"] }`, the complete unfiltered Open snapshot displayed in the confirmation (refreshed while the dialog is open). The server validates lecture ownership, locks the lecture and eligible questions, and deletes only snapshot IDs still unanswered in that lecture. It returns the IDs actually removed. Answered questions, other lectures, and submissions outside the confirmed snapshot survive; pool/session state is unchanged. A repeated request is safe. The frontend updates from returned IDs and normal polling.

Professor profiles are account-scoped even with testing permissions. `POST /professor/profile/initialize` accepts `{ "onboardingCompleted": false, "courses": [] }` or a valid legacy browser profile's completion and ordered courses. Initialization serializes concurrent first-use requests; an existing database profile is returned unchanged and is always authoritative. No request accepts another professor's identity as a target.

A profile response is `{ "onboardingCompleted": true, "revision": 1, "courses": [{ "id": "stable-course-id", "title": "Algebra" }] }`. `PUT` accepts those same fields and atomically replaces the ordered course list if the revision matches. Stale saves return 409 and the frontend loads the current profile before retry. Completion is monotonic, including with an empty list. Titles are trimmed, nonblank, at most 120 characters, and unique ignoring case within one account. Names, IDs and order persist in normalized profile/course tables. Course changes never update lecture snapshots or end sessions.

Lecture creation body:

```json
{ "title": "Algorithms", "lectureTime": "2026-10-10T10:00:00Z" }
```

Title is trimmed, 1-200 characters. Time is required. The frontend creates a lecture with the selected course as its title and the current time, then starts it. The invite screen shows its numeric ID and renders a QR for `/student/join?code=123`. Students may scan it or type the ID. `POST /api/sessions/join` with `{ "code": "123" }` validates that the lecture is active and stores one selected lecture per signed-in student. `GET /api/sessions/mine` restores it on another device; leaving clears it, and ending the lecture clears all its selections. V8 adds lecture membership after the existing moderation migrations; its generated `join_code` column is unused because the visible code is the lecture ID.

Lecture response:

```json
{
  "id": "123",
  "title": "Algorithms",
  "lectureTime": "2026-10-10T10:00:00Z",
  "canManage": true
}
```

Question creation body: `{ "text": "Why does this invariant hold?" }`. Text is trimmed, 1-200 characters. Students may submit multiple questions per lecture, including after deleting a question.

When `MODERATION_URL` is configured, Java checks abusive language before saving
the question. It sends only `{ "question": "..." }` to
the separate service's `POST /moderate`. General and off-topic questions are
accepted. The service returns only
`{ "decision": "accept" }` or `{ "decision": "reject" }`. An explicit rejection
returns HTTP 422 with `{ "error": "Please avoid abusive language." }`
and saves nothing. Service errors, invalid responses, and timeouts allow the
submission. This check also applies with testing permissions enabled.

Student question response (contains no authors or reports):

```json
{
  "id": "42",
  "text": "Why does this invariant hold?",
  "votes": 3,
  "createdAt": "2026-10-10T10:05:00Z",
  "status": "open",
  "mine": false,
  "votedByMe": true
}
```

Statuses are `open`, `selected`, `answered`. The database retains `unanswered`/`answered` and adds a selection flag. Lists place open/selected questions before answered questions, then sort by votes descending, submission time ascending, and ID ascending. Both dashboards poll questions and lecture lists every five seconds. Lecture lists also refresh when the browser regains focus, while preserving the user's selected lecture.

Vote body: `{ "voted": true }` or `{ "voted": false }`. Repeating either operation is safe; the database allows one vote per user/question. Self-votes return 403. Votes can change after answering. Reports need no body and are deduplicated per user/question.

Professor response:

```json
{
  "id": "42",
  "text": "Why does this invariant hold?",
  "authorId": "student@ethz.ch",
  "upvoteCount": 3,
  "createdAt": "2026-10-10T10:05:00Z",
  "answered": false,
  "status": "selected",
  "answeredAt": null,
  "reportCount": 1
}
```

Status body: `{ "status": "answered" }` (also `open` or `selected`). Answers are verbal; no written text is stored or returned. Answering sets the timestamp and repeats preserve it. Reopening/selecting clears the answered timestamp without changing submission time. Delete returns 204; future requests for that question return 404.

The professor's time filter applies only to Open questions and uses original submission time, with All / 5 / 10 / 15 / 30 minute windows. It recalculates every second even without network changes. Qualifying questions rank by votes, oldest submission, then stable ID; Answered retains all questions. Student lists use the API's `mine` flag to partition own and other questions.

Pool errors use `{ "error": "Human-readable message." }`: 400 invalid body/parameter; 401 missing identity; 403 role/ownership/self-vote; 404 missing or hidden resource; 409 data conflict; 500 unexpected database constraint failure.

Existing routes remain unchanged:

- `GET /api/me`: uses `X-User-Id` and percent-encoded `X-User-Name`; returns `{ "id": "alex@ethz.ch", "name": "Alex Morgan" }` with no-store. Missing identity gives 401 and no body. It does not grant professor rights.
- `GET /api/hello`: unauthenticated, returns `{ "message": "Hello from Java 21" }`.
