# AskPool — history organized by course

This document records the intended behavior for organizing personal lecture history
by durable course identity. The implementation uses Flyway V12 for the new
course-to-session association. See [Database_State.md](Database_State.md) for the
current schema and deployment state.

## 1. Goal and navigation structure

Reorganize Past Lectures for both students and professors around courses.

The primary navigation becomes:

**Past Lectures → course → sessions belonging to that course → session questions**

Use “course” for the reusable subject configured in professor Settings/onboarding, and “session” for one occurrence of that course.

- The Past Lectures overview displays one box per course, rather than one box per session.
- Clicking a course opens a separate page listing that course's past sessions.
- Sorting and filtering belong on the course's session-list page.
- The course overview has no sorting or filtering controls.
- Add sidebar shortcuts that open these same course session-list pages.

Use the current box design, spacing, typography, and accent colors as the visual foundation. There is moderate creative freedom to refine the layout and interactions while preserving this structure.

## 2. Course overview for both roles

Keep Past Lectures as the main navigation destination and page heading.

Each course box should show:

- The course name as the primary text.
- A compact count of the past sessions available to the current user.

Keep the design compact and consistent across the two roles. Session-specific dates, start times, and question counts belong on the session-list page.

The main area of each course box opens that course's session page. These boxes navigate; they do not expand an inline list of sessions.

### Professor overview

- Include the professor's courses from their saved Settings/onboarding profile.
- Follow the professor's configured course order.
- Show newly added courses immediately, even before they have any completed sessions.
- A course with no past sessions displays “0 sessions” and opens a useful empty state.
- Include retained historical courses that have been removed from Settings but still have past sessions. Show these after the current configured courses, with a discreet Archived label.

### Student overview

- Build the list from the student's own retained history of personally joined or visited sessions.
- A course appears once the student has a completed session from that course in their history.
- Joining one session does not expose every other session in that course.
- The session count reflects only that student's available history.
- Use a stable alphabetical course order, with the same order in the sidebar.
- If the student removes their final retained session from a course, remove that course from their overview and sidebar.

Do not add course-level bulk removal or deletion actions.

## 3. Dedicated page for a course's sessions

Both roles should get a dedicated page headed by the selected course's name.

Include:

- A clear way back to the course overview.
- Sorting and filtering controls near the top.
- The list of past sessions for this course.

Reuse the current compact session-box design. Since the course name is already the page heading, avoid repeating it unnecessarily in every session row.

Each session summary should make these details easy to scan:

- Date.
- Start time.
- Total question count.

Retain a distinct session title when it adds information beyond the course name.

Only completed sessions belong in this history list. Reading history must not join a session, end a session, or replace the user's currently joined live session.

### Opening session questions

Reuse the existing role-appropriate session question-view behavior.

- Student session-detail pages should return to the selected course's session list, rather than directly to the overview.
- Professor session rows may retain their existing inline question expansion.
- Preserve question text, Answered/Unanswered status, and existing permitted actions.
- Preserve the student's existing per-session Remove from history action. It affects only that student's history and does not delete the session or anyone else's data.
- Do not introduce an additional mandatory intermediate screen.
- Preserve existing direct session links; resolving a course parent must not itself record a new visit or restore an intentionally removed history entry.

Returning from a session should restore the course's filter, sorting, and useful list position.

## 4. Session sorting and filtering

The user has confirmed the following options.

### Sorting

- **Newest first** — default.
- **Oldest first**.

Sort by the session's actual start date and time, using the existing lecture timestamp as a fallback for older records. Keep equal timestamps in a stable order.

### Date filtering

- **All dates** — default.
- **Last 7 days**.
- **Last 30 days**.
- **Custom range**.

Behavior:

- Filter by the session's start date, using the same fallback as sorting.
- Interpret Last 7 days as today and the previous six calendar days; Last 30 days as today and the previous 29 calendar days.
- Use the same local-date interpretation for filtering and displayed dates.
- Custom range provides From and To dates, including both boundary dates.
- An end date before the start date should produce a clear validation message.
- Apply sorting and filtering together.
- Make the active selections visible and provide an easy way to clear the date filter.
- Keep selections stable during refreshes and while opening and returning from session questions.
- Opening a different course starts with Newest first and All dates.
- If no sessions match, distinguish that from a course with no past sessions and offer to clear the filter.

These controls affect only the current course's displayed session list. They do not change history, sidebar contents, or course-overview totals.

## 5. Sidebar course dropdown

Update the sidebar for both students and professors.

Add a small chevron beside **Past Lectures**, consistent with the application's existing disclosure-arrow style.

Use two separate interactions:

- Clicking the Past Lectures label opens the course overview.
- Clicking its chevron expands or collapses the nested course list without navigating.

The dropdown should:

- List the same courses as the role's overview, in the same order.
- Indent course entries clearly beneath Past Lectures.
- Open a course's dedicated session-list page when its name is selected.
- Use the same destination as clicking that course's overview box.
- Highlight the selected course with the existing accent treatment.
- Recognize that a session-detail page still belongs to its parent course.
- Reveal the current course when opening the sidebar from a course or session-detail page.
- Follow the sidebar's existing close behavior after navigation; expanding the dropdown itself must keep it open.
- Handle long course names and long lists without hiding the sidebar's other navigation or account controls.
- Work with touch and keyboard input, with clear focus and expanded/collapsed states.

Use one level of nested course links. Do not put every individual session into the sidebar.

An empty list should show brief, appropriate guidance rather than an empty unexplained dropdown.

Preserve the reviewed sidebar account/Settings design from the newly merged work.

## 6. Keep course pages synchronized with the underlying records

### Professor changes

Adding, renaming, reordering, or removing a course in Settings must update the overview and sidebar consistently.

- Adding creates the corresponding course entry and page.
- Reordering updates the overview and sidebar.
- Renaming updates the course-group heading and navigation label without splitting its sessions into separate groups.
- Existing session titles and historical details retain their saved values, as agreed in the earlier change set.
- Removing a course from Settings removes it from future session selection but preserves its historical course page when past sessions exist.
- Removing a course with no history leaves no empty historical entry.
- If a course is removed while its session is still running, keep that association so the session appears under the retained historical course once it ends.

A newly created course that happens to reuse an old course's name must not automatically absorb the old course's sessions.

### Student updates after lessons

- When a session in the student's personal history ends, make it available under its course.
- Add the course to the overview/sidebar if this is the student's first retained completed session from that course.
- Otherwise update the existing course's session list and count.
- Refresh this information when history is revisited or the app regains focus, as well as through the app's normal live updates.
- Do not require logout or a manual full-page reload.
- Do not automatically add sessions the student never joined or visited.
- Respect deliberate Remove from history actions: background refreshes must not restore removed sessions.
- Changes to the professor's course name should update the group's current display name while preserving each historical session's saved details.
- A professor removing a course must not erase a student's retained session history.

If a student removes the final visible session while viewing that course, show an empty state with a way back to the overview. Do not silently open another course.

## 7. Course identity and access boundaries

Course grouping must be reliable across renames and different professors.

The inspected baseline gives professor courses stable identities but session creation copies only course/title text. Profile saves also replace course records. Address those lifecycle issues rather than grouping solely by labels.

Required outcomes:

- Group sessions by their actual course identity, not solely by matching display names.
- Keep identically named courses from different professors separate.
- Preserve the distinction between a removed course and a newly created course with the same name.
- Keep professor history limited to the professor's own manageable sessions.
- Keep student history limited to that student's retained personally visited sessions.
- Use discreet identifying context when distinct courses share the same displayed name.
- Preserve current profile revision/conflict handling and course-order behavior.

Make only the supporting data/API changes necessary for reliable grouping and synchronization; avoid an unrelated account or permissions redesign.

For older sessions without a clear course association, preserve accessible history and use a safe compatibility approach. Do not lose records or silently guess associations where the available data is ambiguous. Never infer student attendance from another person's history or from a global course list.

## 8. Navigation, layout, and state quality

- Course pages must support direct links, refresh, and browser Back/Forward.
- Sidebar shortcuts and overview boxes must lead to the same course page.
- Browsing course history must preserve the current live lecture and its existing behavior.
- Use clear loading, empty, unavailable, and retry states.
- Do not display loading or failed counts as genuine zero counts.
- Keep successfully loaded content visible during recoverable refresh failures where practical.
- Preserve the existing mobile student question tabs and all previously accepted behavior.
- Check the complete flow on mobile and desktop, including long course names, many courses, and many sessions.
- Keep role-specific visual styling coherent while giving both histories the same overall information structure.

## 9. Acceptance scenarios

Verify at least these scenarios:

1. A professor has three configured courses and several sessions per course. The overview shows three course boxes, and each opens only its own sessions.
2. A newly configured course appears with zero sessions in both the professor overview and sidebar.
3. A student visited two of a course's five sessions. Their course page contains only those two.
4. A visited live session ends. Its course entry and session count update without a full reload.
5. A course is renamed or reordered. Its sessions remain grouped, navigation updates, and old session details remain intact.
6. A course is removed from Settings. Its retained historical sessions remain accessible to the professor and relevant students. A running session still acquires the correct historical parent after it ends.
7. Two professors use the same course name, or a professor creates a new course with a previously removed name. Distinct courses and sessions are not combined.
8. The student removes their last retained session from a course. The course disappears from their overview/sidebar without affecting anyone else or returning through polling.
9. Both sort directions and every date-filter option work, including custom boundary dates and sessions on the same day.
10. Filtering to no results does not make the course disappear from navigation.
11. The Past Lectures chevron toggles its dropdown without navigation. Selecting a course opens the correct page.
12. Course links, existing session links, refresh, and browser Back/Forward preserve the correct context.
13. Reading history leaves the currently joined live lecture intact.
14. Saving the professor profile, including from another browser, preserves course associations, archived sessions, and the existing conflict-handling behavior.
15. The merged sidebar account and Settings design remains intact.

Run the repository checks appropriate to the final implementation, including supporting backend/migration changes where made, and visually inspect the rendered interfaces rather than relying only on compilation.

## 10. Current source orientation

- `frontend/src/components/SidePanel.tsx`, `Icons.tsx`, and `side-panel.css`: shared navigation and the merged sidebar account design.
- `frontend/src/student/components/StudentHistory.tsx`: current student session list and history removal.
- `frontend/src/student/components/StudentLecturePage.tsx`: current student historical-session detail view and back navigation.
- `frontend/src/student/StudentDashboard.tsx` and `frontend/src/student/lib/useStudentHistory.ts`: routing, personal history, and live-session separation.
- `frontend/src/professor/ProfessorDashboard.tsx`: current professor archive and session views.
- `frontend/src/professor/professorApi.ts`: current course-to-session creation flow.
- `frontend/src/professor/CourseSettings.tsx`, `professorProfile.ts`, and `profileApi.ts`: profile/course lifecycle.
- `backend/src/main/java/com/example/backend/pool/ProfessorProfileService.java`: profile-save behavior and revision checks.
- `backend/src/main/java/com/example/backend/pool/ApiModels.java`, `PoolService.java`, and `PoolRepository.java`: existing course/session data and personal-history boundaries.
- `docs/Database_State.md`: current account/history model; read source when documentation and code differ.
- `docs/Local_Development.md` and `dev-local.ps1`: local startup guidance.

These pointers are orientation aids, not mandatory implementation boundaries.
