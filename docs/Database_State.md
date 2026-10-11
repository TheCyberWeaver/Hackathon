# Database state: personal accounts and lecture history

Last checked: 11 October 2026. This branch now includes Flyway **V11**. The shared VM was verified at **V9** before this change; this work does not deploy or migrate production. All existing VM lectures have an owner. The VM also retains the legacy `votes` table.

## Account model

One `users` row represents one stable identity supplied by the login proxy in `X-User-Id`. Student and Professor are views of the same account. Every signed-in user has the same capabilities, regardless of the legacy `users.role` value. Ownership still determines whose records they may manage. There is no global admin or testing bypass in the application.

Professor history consists of lectures created by the caller (`lectures.owner_id`). Student history consists of lectures visited by the caller (`lecture_history.user_id`). The same account may have both. Joining another person's lecture does not grant ownership, expose question authors, or add it to the visitor's professor history.

## Tables after V11

| Table                          | Key and purpose                                                                                             | Account boundary                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `users`                        | Identity `id`, unique nonblank `eth_identity_ref`, legacy `role`                                            | One row per authenticated identity; role does not change permissions                           |
| `lectures`                     | `id`, title/course snapshots, lecture/start/end times, pause flag, `owner_id`, legacy generated `join_code` | Creator owns management, professor archive and summary; shared link uses numeric `id`          |
| `lecture_history` **new**      | Primary key `(user_id, lecture_id)`; first/last visit timestamps                                            | One entry per user's visited lecture; persists after leaving or ending                         |
| `lecture_memberships`          | Primary key `user_id`, selected `lecture_id`, `joined_at`                                                   | One current lecture per user; leaving/ending clears this selection only                        |
| `professor_profiles`           | Primary key `user_id`, onboarding completion, revision                                                      | Own profile; revision detects concurrent edits                                                 |
| `professor_courses`            | Primary key `(user_id, id)`, title, position; unique position and case-insensitive title per user           | Own ordered course list; same course name is allowed for different users                       |
| `questions`                    | `id`, lecture/author references, text, status, and unique 32-byte deletion-token hash                       | Matching account token required for deletion; lecture owner can mark answered and see author/report data |
| `question_deletion_tokens`     | One row per question with `user_id` and matching unique 32-byte token hash                                  | Account association checked for every deletion; removed with its question |
| `question_votes`               | Primary key `(question_id, user_id)`                                                                        | Own vote, one per question; self-votes rejected                                                |
| `question_reports`             | Primary key `(question_id, user_id)`, report time                                                           | Own report; counts visible only to lecture owner                                               |
| `question_moderation_warnings` | `id`, lecture/user references, reason, creation time                                                        | Warnings/counts linked to the submitting account and lecture                                   |
| `flyway_schema_history`        | Installed migrations and checksums                                                                          | Database migration bookkeeping                                                                 |

The VM's older `votes` table is retained for compatibility. Some older installations also have `lectures.professor_id` and a trigger that fills it alongside `owner_id`; V3 preserves those installations. New empty databases use `owner_id` only. V10 and V11 do not rewrite earlier migrations or their checksums.

V11 backfills existing questions with hashes of ephemeral cryptographically generated values and associates each hash with the original author. New questions use 256-bit random tokens hashed with SHA-256 before storage. The plaintext is never persisted or returned. A token table row cannot reference a different question hash, and both hashes are unique. Deletion checks the account-associated hash and removes the token row and question in one transaction. Professor bulk clear can only remove the lecture owner's own open questions and refuses a mixed-account snapshot without partial deletion.

This is an authorization boundary, not database anonymity. `questions.author_id` remains because public “mine” flags, self-vote checks, student summaries, and professor author views use it. Anyone with access to both tables can also recover account-to-question links through `question_deletion_tokens`.

## V10 upgrade and history behavior

V10 creates `lecture_history` with foreign keys to users and lectures, a unique user/lecture pair, a timestamp ordering constraint, indexes for personal recency and lecture lookups, and an owner/time index on lectures. Deleting a history entry does not delete a lecture, questions, another user's history, or the active membership. Revisiting adds the entry again. Read-only polling never re-adds removed history.

Existing attendance is backfilled from current memberships, authored questions, votes in `question_votes`, and reports. For votes, the question submission time is used because vote timestamps were not stored. Earlier visits that left no surviving record cannot be reconstructed. The migration does not guess attendance from a shared global lecture list or assign another person's lecture to the caller.

Existing professor profiles, course order/revisions, questions, ownership and memberships remain intact. Legacy lectures with no owner remain unowned until an operator assigns the correct account; they do not become manageable by all users. The inspected VM has no such unowned lectures.

V9 previously removed written-answer and soft-deletion columns and permanently deleted old trash. Questions now use permanent deletion, cascading to dependent votes/reports. V10 does not change that behavior or recover previously deleted content.

Apply V11 through the usual web app deployment. `deploy-webapp.ps1 -ValidateOnly` tests a disposable database; an actual deployment backs up production before applying migrations. Deploy this backend and its matching frontend together so the professor UI reflects the token-based deletion rule.
