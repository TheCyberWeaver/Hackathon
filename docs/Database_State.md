# Database state: personal accounts and lecture history

Last checked: 11 October 2026. This branch introduces Flyway **V10**. The shared VM was verified at **V9** before this change; this work does not deploy or migrate production. All existing VM lectures have an owner. The VM also retains the legacy `votes` table.

## Account model

One `users` row represents one stable identity supplied by the login proxy in `X-User-Id`. Student and Professor are views of the same account. Every signed-in user has the same capabilities, regardless of the legacy `users.role` value. Ownership still determines whose records they may manage. There is no global admin or testing bypass in the application.

Professor history consists of lectures created by the caller (`lectures.owner_id`). Student history consists of lectures visited by the caller (`lecture_history.user_id`). The same account may have both. Joining another person's lecture does not grant ownership, expose question authors, or add it to the visitor's professor history.

## Tables after V10

| Table                          | Key and purpose                                                                                             | Account boundary                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `users`                        | Identity `id`, unique nonblank `eth_identity_ref`, legacy `role`                                            | One row per authenticated identity; role does not change permissions                           |
| `lectures`                     | `id`, title/course snapshots, lecture/start/end times, pause flag, `owner_id`, legacy generated `join_code` | Creator owns management, professor archive and summary; shared link uses numeric `id`          |
| `lecture_history` **new**      | Primary key `(user_id, lecture_id)`; first/last visit timestamps                                            | One entry per user's visited lecture; persists after leaving or ending                         |
| `lecture_memberships`          | Primary key `user_id`, selected `lecture_id`, `joined_at`                                                   | One current lecture per user; leaving/ending clears this selection only                        |
| `professor_profiles`           | Primary key `user_id`, onboarding completion, revision                                                      | Own profile; revision detects concurrent edits                                                 |
| `professor_courses`            | Primary key `(user_id, id)`, title, position; unique position and case-insensitive title per user           | Own ordered course list; same course name is allowed for different users                       |
| `questions`                    | `id`, lecture/author references, text, submission time, status, selected flag, answered time                | Author or lecture owner can delete; lecture owner can mark answered and see author/report data |
| `question_votes`               | Primary key `(question_id, user_id)`                                                                        | Own vote, one per question; self-votes rejected                                                |
| `question_reports`             | Primary key `(question_id, user_id)`, report time                                                           | Own report; counts visible only to lecture owner                                               |
| `question_moderation_warnings` | `id`, lecture/user references, reason, creation time                                                        | Warnings/counts linked to the submitting account and lecture                                   |
| `flyway_schema_history`        | Installed migrations and checksums                                                                          | Database migration bookkeeping                                                                 |

The VM's older `votes` table is retained for compatibility. Some older installations also have `lectures.professor_id` and a trigger that fills it alongside `owner_id`; V3 preserves those installations. New empty databases use `owner_id` only. V10 does not rewrite earlier migrations or their checksums.

## V10 upgrade and history behavior

V10 creates `lecture_history` with foreign keys to users and lectures, a unique user/lecture pair, a timestamp ordering constraint, indexes for personal recency and lecture lookups, and an owner/time index on lectures. Deleting a history entry does not delete a lecture, questions, another user's history, or the active membership. Revisiting adds the entry again. Read-only polling never re-adds removed history.

Existing attendance is backfilled from current memberships, authored questions, votes in `question_votes`, and reports. For votes, the question submission time is used because vote timestamps were not stored. Earlier visits that left no surviving record cannot be reconstructed. The migration does not guess attendance from a shared global lecture list or assign another person's lecture to the caller.

Existing professor profiles, course order/revisions, questions, ownership and memberships remain intact. Legacy lectures with no owner remain unowned until an operator assigns the correct account; they do not become manageable by all users. The inspected VM has no such unowned lectures.

V9 previously removed written-answer and soft-deletion columns and permanently deleted old trash. Questions now use permanent deletion, cascading to dependent votes/reports. V10 does not change that behavior or recover previously deleted content.

Apply V10 through the usual web app deployment. `deploy-webapp.ps1 -ValidateOnly` tests a disposable database; an actual deployment backs up production before applying migrations. Deploy this backend and its matching frontend together: the previous backend would still expose shared professor data even if V10 existed.
