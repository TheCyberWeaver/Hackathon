# Professor dashboard

The dashboard uses Java/PostgreSQL for profiles, ordered courses, session state, questions, votes, reports and answered status. [API contract](API.md) and [approved behavior](AskPool_Product_Changes.md) describe the interfaces and acceptance criteria.

Professor entry initializes or loads the saved profile, showing an error with Retry when loading fails. A valid legacy browser profile is imported only when no database profile exists. Both Done and Skip for now persist completion; Skip keeps added courses and ignores the unfinished draft. An empty course list is valid. Settings supports add, rename, remove, and button-based reordering, with shared validation and optimistic revision checking across devices.

The course chooser can save a course inline and select it without starting a session. Start session remains explicit. A created session retains the selected course name as its title; later course edits do not change running or archived lecture names. The invite page shows the numeric lecture ID and QR link. Show join code, Pause/Resume questions, and End lecture remain available on the question page.

Open questions have All / Last 5 / 10 / 15 / 30 minutes filtering, based on submission time and updated every second. Lists rank by current votes, oldest submission, and ID. Open counts and Top voted badges use the filtered list. The Answered tab has no filter; switching back retains the current lecture's filter. New lectures reset it.

Mark answered records verbal status. Expanded cards show submission time and report count. Single Delete and Clear all questions require permanent-deletion confirmation. Clear snapshots the entire unfiltered Open list, refreshes its count while the dialog is open, and freezes its IDs when confirmed. The server checks ownership, lecture and current status again. New submissions outside that snapshot, Answered questions and other lectures survive. Votes and reports cascade on deletion. Failures retain the dialog and allow retry.

Past Lectures starts collapsed, newest first. Each compact summary shows its saved name, time range, question count and answered count. Expanded cards contain full question text and Answered/Unanswered status. Empty sessions remain visible. Profile summaries and all live lists refresh from persisted state.

V9 removes existing written answers and old trash, and creates profile/course tables. No live database is modified by the implementation tests. Run the usual backend `gradlew test bootJar`, frontend build/lint/API/profile checks, and [browser acceptance tests](../frontend/README.md).
