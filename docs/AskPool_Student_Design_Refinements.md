# AskPool — student frontend design refinements

Project: `C:\Users\qiang\Documents\Coding\Hackathon_ethz\hackathon-app-2\Hackathon`
Date: 2026-10-11
Scope: frontend design and the presentation interactions needed for these two student-facing changes.

This is a follow-up to the successfully implemented `docs/AskPool_Product_Changes.md`. Preserve that work. Implement this document's two refinements without reopening settled product decisions. The user has authorized reasonable design assumptions and creative exploration; use judgment rather than conducting another detailed interview.

## 1. Mobile student question lists: adjacent text tabs

Replace the round icon button that switches between the student's question lists with two visible text tabs on the same row:

**Your questions**    **Other questions**

### Appearance

- Keep both labels visible together, with Your questions on the left and Other questions on the right.
- Give them the same typographic format and hierarchy, consistent with the existing question-section headings.
- Highlight the selected label in the student interface's existing blue accent color. Add a restrained underline or comparable selection indicator so selection is also understandable without relying only on color.
- Use a quieter, readable neutral color for the unselected label.
- Remove the old circular switch button and the separate heading that changes between the two labels. The tabs themselves provide the section navigation.
- Keep the row lightweight and integrated into the page; avoid oversized buttons or a new visual style unrelated to the current app.
- Ensure both labels fit on small phones without clipping or horizontal scrolling. Adjust both labels' size and spacing consistently where necessary.
- Provide comfortable touch targets even though the controls look like text.

### Interaction

- Selecting Your questions shows the student's own questions; selecting Other questions shows questions from other students.
- Each tab selects its named list directly. Tapping the already selected tab does nothing.
- Keep the current initial selection of Other questions.
- Preserve the existing successful-submission behavior: automatically select Your questions, make the newly submitted question visible, and briefly highlight it.
- Keep the corrected separation between owned and other questions, their existing ordering, empty states, voting, and own-question vote explanation.
- Switching lists should feel smooth and avoid disruptive jumps to the page top, large blank gaps, or losing the question-list position.
- Use proper accessible tab behavior, visible keyboard focus, and a clear relationship between the selected tab and its list. Respect reduced-motion preferences.
- Apply this change wherever the existing mobile question-list layout is used. Keep the desktop layout with its existing separate Your questions and Other Questions sections.

### Acceptance

On a phone-sized viewport, both text labels are visible simultaneously. Selecting either displays exactly that list and moves the accent highlight. Submitting a question selects Your questions. The old circular switch button is absent, and the desktop question-page layout still works as before.

## 2. Redesign the student's Past Lectures page

Replace the current placeholder-style panel and plain lecture links with a polished, compact history list inspired by the professor's existing Past Lectures page. Use the student interface's existing colors, typography, borders, and spacing so the result feels native to the student space.

### Page structure and visual direction

- Keep one clear Past Lectures page heading.
- Remove the redundant nested Past lectures heading and developer-style explanatory panel.
- Use a list of individually bordered, subtly rounded lecture boxes with light surfaces and restrained spacing.
- Above the list, place a thin horizontal divider and a compact date-sort control with a recognizable sort icon. A suitable arrangement is the line extending through the available space with the control aligned to its right.
- The sort control must show the selected ordering in readable text, rather than relying on an unexplained icon.

### Compact lecture summaries

Each collapsed lecture box should contain:

- **Left:** the lecture/session name as the primary text.
- **Right, in smaller gray text:** only the date, start time, and total number of questions.

For example, the content could read:
`Linear Algebra                           11 Oct 2026 · 09:15 · 12 questions`

This is a content/layout illustration, not a fixed-width implementation requirement.

- Remove the professor reference design's blue dropdown arrow and any native disclosure marker.
- Move the metadata to the right side of the summary instead of a full-width line beneath the title.
- Do not include end time, duration, answered count, repeated course names, or labels such as Course and Time slot.
- Display the date once and the session's start time once, using a readable format consistent with the app. Prefer a compact 24-hour time.
- Use the actual session start time when available; use the existing lecture time as the fallback for older records.
- The question total includes all retained questions in that lecture, regardless of answered status, and excludes deleted questions. Use correct singular/plural wording.
- Reduce the overall height and internal padding compared with the professor reference's stacked summaries, while retaining usable touch targets.
- Give the title and right-hand metadata enough separation to remain scannable.
- On narrow screens, allow the right-hand metadata to wrap compactly within its own area. Keep long titles readable and avoid overlapping content, horizontal overflow, or restoring a bulky full-width description below the title.

### Opening a lecture

Assumption for this design round: removing the dropdown arrow changes the visual treatment, while lecture rows still expand and collapse to reveal their questions.

- Start with every lecture collapsed.
- Make the whole summary row clickable/tappable and keyboard operable.
- Communicate interactivity and the expanded state with restrained hover, focus, and surface/border treatment, without adding a replacement arrow.
- Expand questions inline below the summary with a subtle divider.
- Use compact question text and small Answered/Unanswered status labels, consistent with the professor history design. Preserve anonymity and display full question text.
- The history view is for reading. Do not place a new-question composer or live-session controls inside an expanded archived lecture.
- Browsing a past lecture must not join it, replace the student's currently joined live lecture, or redirect the student to the join screen.
- Expanding or collapsing one entry should preserve the user's place in the list.

### Date sorting

- Provide exactly two options: **Newest first** and **Oldest first**.
- Default to Newest first.
- Sort chronologically by session start date and time, using the same timestamp fallback as the summary. Use a stable order when timestamps match.
- Apply selection immediately and update the visible sort label.
- Keep the selected order during list refreshes and expansion/collapse.
- Reordering should preserve which lecture entries are expanded.
- Keep the control usable by touch and keyboard, with clear focus and selected states.
- No backend preference storage is required for this display choice.

### Data and edge states

- Show ended lectures available through existing student-accessible data. Keep live/scheduled lectures out of the Past Lectures list.
- Use existing read APIs for lecture details, questions, and totals. This round does not add database changes, endpoints, attendance tracking, or access-policy changes.
- Keep historical display state separate from the current live-session state.
- Show concise loading feedback. A count that is still loading or failed must not falsely display as zero.
- A genuine zero-question lecture remains visible with 0 questions and a concise empty message when expanded.
- Show a friendly No past lectures yet state when appropriate.
- Provide retry feedback for failed loading, without unnecessarily removing successfully loaded entries.
- Avoid repeated unnecessary requests while switching sort order or expanding already loaded entries.

### Acceptance

- The student history page shows compact lecture boxes rather than plain links in a placeholder panel.
- Collapsed boxes have a title on the left and only date, start time, and question total on the right.
- No blue arrow or native dropdown marker appears.
- Newest first and Oldest first produce the correct chronological ordering, including lectures on the same date.
- Expanding a row displays its questions inline without interfering with the currently joined live lecture.
- The design remains readable and compact on a small phone, a larger phone/tablet, and desktop, including long lecture titles and empty histories.

## Scope and verification

- This is a frontend design iteration. Keep professor screens and the previous round's backend behavior intact.
- Frontend state/data-loading adjustments required to make the new views work are in scope.
- Preserve unrelated user changes. Leave all work uncommitted; do not commit, push, switch branches, reset, or perform other Git mutations.
- Use the existing frontend checks appropriate to the change, including build and lint.
- Visually inspect the actual rendered result at representative mobile and desktop widths. Do not rely only on source inspection or automated compilation.
- Exercise tab selection, post-submit selection, empty lists, history expansion, both sort orders, long titles, loading/error feedback, and continuity of a joined live lecture.
- Use existing local data where possible. Do not reset or clear the user's local database to prepare a demonstration.
- Technical details such as component boundaries, precise dimensions, and request coordination are implementation choices. Prioritize the interaction and visual results described here.

## Required finish: leave the local application running

**At the end of implementation, keep the updated local version running so the user can immediately click through the changes. This is part of completion, not an optional follow-up.**

- Inspect the existing local development setup and use the correct hackathon-app-2 checkout.
- Reuse an already running instance if it serves the correct checkout and the new changes. Otherwise start the local frontend and the backend/database services it needs.
- Keep the processes alive after the implementation chat's final message. A server that stops when a temporary tool command or test finishes does not satisfy this requirement.
- Run background helpers without opening visible terminal windows unless the user asks for them.
- Verify that the actual student pages load and their data requests succeed. Do not report success merely because a development-server process started.
- Avoid disrupting an unrelated server or local database. If an unrelated process occupies the default port, use a suitable alternate local port and report the actual URL.
- Do not deploy or modify remote/live data.
- In the final response, provide clickable links to the running local student page and Past Lectures page, identify the port if it differs from the usual one, and briefly state what was verified.
- Explain how to access the mobile tab layout, such as using a narrow browser viewport, and provide a short practical click-through sequence.
- Report any genuine launch blocker accurately. Do not claim that the local app is running unless it was verified and left running.

## Current source starting points

These are orientation aids, not mandatory implementation boundaries:

- `frontend/src/student/StudentDashboard.tsx`: mobile list selection and the current student history placeholder.
- `frontend/src/student/components/ViewSwitchButton.tsx`: old circular switch control.
- `frontend/src/student/student.css`: existing student theme, responsive layout, and question-section styles.
- `frontend/src/professor/ProfessorDashboard.tsx`: compact professor history reference.
- `frontend/src/lib/poolApi.ts` and `frontend/src/student/lib/studentApi.ts`: existing lecture/question read interfaces.
- `docs/Local_Development.md` and `dev-local.ps1`: local startup guidance. Inspect actual current code where older documentation refers to features removed in the previous round.
