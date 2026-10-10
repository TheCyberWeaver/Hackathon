# AskPool Java API contract

This initial contract can evolve. Java wire records in `ApiModels.java` are separate from database columns. Update this document and the frontend adapters (`src/lib/poolApi.ts`, `src/student/lib/studentApi.ts`, `src/professor/professorApi.ts`) together. Breaking changes require a coordinated frontend release or versioned routes. The old Node list/create `/api/questions` routes are replaced by explicit lecture routes.

Every pool route requires the trusted proxy's `X-User-Id`. New identities become students. Permissions come from `users.role`, never a browser role or dashboard selection. Only a lecture's owner or an admin may view authors/report counts or moderate. Any authenticated user can view anonymous pools and report. This prototype has no enrollment checks: a lecture ID is not a private access token. Keep Java behind the managed login proxy with no public port.

For hackathon testing, the deployment enables `APP_TESTING_PERMISSIONS=true`.
Every signed-in account can then create/manage every lecture, submit questions,
vote, view authors/reports through the professor API, and moderate questions,
regardless of its stored role or lecture ownership. All lecture responses have
`canManage: true`, so both dashboards show the same available lectures. Database
roles remain unchanged. The table below describes restricted mode, restored with
`APP_TESTING_PERMISSIONS=false`. Sign-in, text validation, vote uniqueness,
and the self-vote restriction apply in both modes. Multiple questions per lecture are allowed.

IDs in JSON are decimal strings, avoiding JavaScript BIGINT precision loss. Times are ISO 8601 with an offset. Pool responses use `Cache-Control: no-store`.

| Method | Route                                       | Success                         | Permission                         |
| ------ | ------------------------------------------- | ------------------------------- | ---------------------------------- |
| GET    | `/api/lectures`                             | `Lecture[]`, newest time first  | Signed in                          |
| GET    | `/api/lectures/{id}`                        | `Lecture`                       | Signed in                          |
| POST   | `/api/lectures`                             | 201 `Lecture`, Location header  | Professor/admin                    |
| GET    | `/api/lectures/{id}/questions`              | `Question[]`                    | Signed in                          |
| GET    | `/api/lectures/{id}/questions/{questionId}` | `Question`                      | Signed in                          |
| POST   | `/api/lectures/{id}/questions`              | 201 `Question`, Location header | Student                            |
| POST   | `/api/questions/{id}/vote`                  | `Question`                      | Student, another author's question |
| POST   | `/api/questions/{id}/report`                | 204                             | Signed in                          |
| GET    | `/api/lectures/{id}/professor/questions`    | `ProfessorQuestion[]`           | Owner/admin                        |
| PATCH  | `/api/questions/{id}/status`                | `ProfessorQuestion`             | Owner/admin                        |
| DELETE | `/api/questions/{id}`                       | 204                             | Question author or lecture owner/admin |

Lecture creation body:

```json
{ "title": "Algorithms", "lectureTime": "2026-10-10T10:00:00Z" }
```

Title is trimmed, 1-200 characters. Time is required. The frontend currently creates a lecture with the current time. Share `/student?lecture=123` to join; QR image generation is not implemented.

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

Status body: `{ "status": "answered" }` (also `open` or `selected`). Answering sets the timestamp; repeats preserve it. Reopening/selecting clears it. No written answers are stored in this schema. Deletion hides content from both dashboards and preserves attribution, votes, and reports for audit purposes. Actions on hidden questions return 404.

Pool errors use `{ "error": "Human-readable message." }`: 400 invalid body/parameter; 401 missing identity; 403 role/ownership/self-vote; 404 missing or hidden resource; 409 data conflict; 500 unexpected database constraint failure.

Existing routes remain unchanged:

- `GET /api/me`: uses `X-User-Id` and percent-encoded `X-User-Name`; returns `{ "id": "alex@ethz.ch", "name": "Alex Morgan" }` with no-store. Missing identity gives 401 and no body. It does not grant professor rights.
- `GET /api/hello`: unauthenticated, returns `{ "message": "Hello from Java 21" }`.
