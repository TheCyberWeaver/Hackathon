# AskPool — student frontend design refinements

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

Each lecture summary should contain:

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

The merged design opens a separate read-only lecture page when a history row is selected.

- Show compact summary rows without question text on the history list.
- Make the whole summary row clickable/tappable and keyboard operable.
- Communicate interactivity with restrained hover, focus, and surface/border treatment, without adding a replacement arrow.
- Open a separate lecture page showing questions and their statuses.
- Use compact question text and small Answered/Unanswered status labels, consistent with the professor history design. Preserve anonymity and display full question text.
- The history view is for reading. Do not place a new-question composer or live-session controls on the archived lecture page.
- Browsing a past lecture must not join it, replace the student's currently joined live lecture, or redirect the student to the join screen.
- Opening a lecture and returning to the list should preserve the selected sort order.

### Date sorting

- Provide exactly two options: **Newest first** and **Oldest first**.
- Default to Newest first.
- Sort chronologically by session start date and time, using the same timestamp fallback as the summary. Use a stable order when timestamps match.
- Apply selection immediately and update the visible sort label.
- Keep the selected order during list refreshes and when returning from an archived lecture page.
- Keep the control usable by touch and keyboard, with clear focus and selected states.
- No backend preference storage is required for this display choice.

### Data and edge states

- Show ended lectures available through existing student-accessible data. Keep live/scheduled lectures out of the Past Lectures list.
- Use existing read APIs for lecture details, questions, and totals. This round does not add database changes, endpoints, attendance tracking, or access-policy changes.
- Keep historical display state separate from the current live-session state.
- Show concise loading feedback. A count that is still loading or failed must not falsely display as zero.
- A genuine zero-question lecture remains visible with 0 questions and a concise empty message on its lecture page.
- Show a friendly No past lectures yet state when appropriate.
- Provide retry feedback for failed loading, without unnecessarily removing successfully loaded entries.
- Avoid repeated unnecessary requests while switching sort order or reopening already loaded entries.

### Acceptance

- The student history page shows compact lecture boxes rather than plain links in a placeholder panel.
- Collapsed boxes have a title on the left and only date, start time, and question total on the right.
- No blue arrow or native dropdown marker appears.
- Newest first and Oldest first produce the correct chronological ordering, including lectures on the same date.
- Opening a row displays its questions on a separate page without interfering with the currently joined live lecture.
- The design remains readable and compact on a small phone, a larger phone/tablet, and desktop, including long lecture titles and empty histories.

## Integration notes

Past Lectures uses each signed-in account's saved lecture history and shows ended lectures. Opening one uses the existing question read API without joining it or replacing an active session. A student can remove an ended lecture from their own history without deleting its questions or affecting another account. The separate lecture page has no composer or live controls.
