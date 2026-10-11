# Database state

Flyway migrations **V1–V12** define the current schema. The Java backend applies pending migrations at startup. An existing VM database must be backed up before deployment; see [deployment](../deploy/README.md). Do not edit already-applied migration files.

## Identity and ownership

`users.eth_identity_ref` identifies the account supplied by the managed login proxy. Student and Professor are views of the same account; the legacy `users.role` field does not grant capabilities. `lectures.owner_id` controls lecture management, the professor archive, and author visibility. `lecture_history.user_id` records each visitor's own past lectures. `lecture_memberships` holds one currently selected lecture per user. Leaving or ending a lecture clears active membership without erasing history.

| Table | Purpose |
| --- | --- |
| `users` | Stable authenticated identities. |
| `professor_profiles`, `professor_courses` | Per-user onboarding state and ordered courses; V12 archives removed courses instead of reusing their IDs. |
| `lectures` | Owned sessions, start/end and pause state, title and course snapshot, optional course identity, unique six-character hexadecimal `join_code`. |
| `lecture_memberships`, `lecture_history` | Current selection and independently retained visit history. |
| `questions` | Authored questions, status, selection and answer time. Multiple questions per student per lecture are allowed. |
| `question_votes`, `question_reports` | One vote/report per user and question; self-voting is rejected. |
| `question_moderation_warnings` | Rejected-submission reasons linked to lecture and account. |
| `flyway_schema_history` | Migration versions and checksums. |

The question author or lecture owner can permanently delete a question; dependent votes and reports are removed. Only the owner can change question status or delete a completed lecture. A student's deletion from personal history does not delete the lecture or another user's history.

## Migration notes

V10 created per-user history and backfilled visits from surviving memberships, questions, votes, and reports. Earlier visits with no surviving record cannot be reconstructed. V11 replaced old invitation codes with six-character hexadecimal codes, while keeping internal lecture IDs. V12 added stable course identities: `lectures.(owner_id, course_id)` references `professor_courses.(user_id, id)`. Profile edits retain course rows and archive removals; sessions remain linked to archived courses. Older sessions have a null `course_id` because a matching title is not proof of identity. Clients that omit `courseId` can still create an unlinked session.

The supplied VM schema may retain a legacy `votes` table or `lectures.professor_id`; the compatibility migrations preserve these. Fresh databases need no manual schema installation. Keep matching frontend and backend releases together when deploying schema changes.
