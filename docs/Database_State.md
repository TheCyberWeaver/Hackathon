# Database state: personal accounts and lecture history

Last checked: 11 October 2026. This branch includes Flyway **V11** for six-character hexadecimal join codes and introduces **V12** for durable course history. The shared VM was last verified at **V11**; this merge does not deploy or migrate production. All existing VM lectures have an owner. The VM also retains the legacy `votes` table.

## Account model

One `users` row represents one stable identity supplied by the login proxy in `X-User-Id`. Student and Professor are views of the same account. Every signed-in user has the same capabilities, regardless of the legacy `users.role` value. Ownership still determines whose records they may manage. There is no global admin or testing bypass in the application.

Professor history consists of lectures created by the caller (`lectures.owner_id`). Student history consists of lectures visited by the caller (`lecture_history.user_id`). The same account may have both. Joining another person's lecture does not grant ownership, expose question authors, or add it to the visitor's professor history.

## Tables after V12

| Table                          | Key and purpose                                                                                             | Account boundary                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `users`                        | Identity `id`, unique nonblank `eth_identity_ref`, legacy `role`                                            | One row per authenticated identity; role does not change permissions                           |
| `lectures`                     | `id`, title/course snapshots, lecture/start/end times, pause flag, `owner_id`, nullable `course_id`, generated six-character hex `join_code` | Creator owns management, professor archive and summary; `join_code` is used for invitations |
| `lecture_history` **new**      | Primary key `(user_id, lecture_id)`; first/last visit timestamps                                            | One entry per user's visited lecture; persists after leaving or ending                         |
| `lecture_memberships`          | Primary key `user_id`, selected `lecture_id`, `joined_at`                                                   | One current lecture per user; leaving/ending clears this selection only                        |
| `professor_profiles`           | Primary key `user_id`, onboarding completion, revision                                                      | Own profile; revision detects concurrent edits                                                 |
| `professor_courses`            | Primary key `(user_id, id)`, title, position, archived flag; active-only unique position and case-insensitive title per user           | Own ordered course list; same course name is allowed for different users                       |
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


## V12 course identity and lifecycle

`lectures.(owner_id, course_id)` references `professor_courses.(user_id, id)`.
New session creation sends the configured course ID; the server validates ownership
and active status and saves the authoritative course title as the session snapshot.
The API additionally returns a scoped `courseKey`, the current `courseName`, and
`courseArchived`. Profile courses return the corresponding `historyKey`.

Profile saves retain existing rows, update their titles/order, archive removals, and
insert new IDs. Active-only uniqueness permits archived titles/positions to be
reused without combining identities. Archived IDs cannot be reused; adding a course
with the same name requires a new ID. Profile revision checks and transactions are
unchanged. Session creation and profile changes serialize using the profile row.
Running sessions retain their association when a course is removed.

Earlier saves replaced course records and could reuse names, so V12 does not infer
legacy course identity from labels. Their nullable associations remain intact;
the frontend gives each unlinked session a distinct, labelled legacy entry. This
also supports older API clients that omit `courseId`. No lectures, questions,
memberships, profiles, or personal-history entries are deleted by V12.

Student groups derive exclusively from retained personal history; professor groups
combine configured courses with owned completed sessions. Read-only historical
`?lecture=` links and parent resolution do not record attendance. Explicit join/visit
actions can still add history. Course sorting/filtering is a local view stored in
the course URL and cannot change history membership or the current live session.

Use the matching frontend/backend versions together: older backend profile-save
code deletes course rows and is incompatible with the new course foreign key.
The existing local database was upgraded through Flyway without a reset. No remote
database was modified as part of this implementation.
