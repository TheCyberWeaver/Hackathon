# AskPool — agreed product changes and acceptance criteria

Project: `C:\Users\qiang\Documents\Coding\Hackathon_ethz\hackathon-app-2\Hackathon`

This specification defines the desired user experience and behavior. The implementation agent should choose the technical approach, including components, database structure, and API changes.

A **course** is a reusable entry in a professor’s course list. A **lecture/session** is a particular teaching session started for a course. Editing the course list affects future sessions; existing sessions retain their names and history.

## 1. Important-question alarm — deferred

The alarm is a future idea and is excluded from this change set.

## 2. Simplify the homepage and enter spaces directly

- Keep AskPool branding, “Choose your space,” and two clearly clickable choices: **Student** and **Professor**.
- Keep the signed-in user’s name when available.
- Remove role descriptions, promotional copy, explanatory footnotes, and the separate Continue button.
- Clicking Student or Professor immediately begins entry into that space. There is no intermediate selected state requiring another confirmation.
- Preserve the necessary sign-in flow. If sign-in is required, retain the chosen destination through that flow.
- Entering the professor space still respects onboarding: a professor who has not completed or skipped setup sees onboarding.
- Retain concise loading and error feedback where needed. Repeated clicks while entry is processing must not trigger duplicate navigation.
- Both role choices must work with touch and keyboard input.

**Acceptance:** A signed-in user can enter either space with one click. There is no additional homepage Continue step and no role-description text.

## 3. Professor onboarding: add “Skip for now” and replace “+”

This applies to the **“What courses do you teach?”** screen.

- Replace the plus-only course-add button with a visibly labeled **Add** button.
- Preserve Enter-to-add and the existing course-title validation.
- Add a clearly visible **Skip for now** action.
- Skip is available even when the professor has added no courses.
- On Skip:
  - Keep courses already added to the list.
  - Ignore unfinished input that has not been added.
  - Save onboarding as completed for that professor.
  - Enter the professor dashboard directly.
- A professor who skips setup must be able to use the dashboard with an empty course list.
- Onboarding completion must follow the professor across browsers and devices through their saved profile.
- Removing every course later must not trigger onboarding again.
- If saving completion or the course list fails, retain the current screen and entered information, show an error, and allow retry.

The existing Done flow remains available for professors who complete course setup normally.

**Acceptance:** A professor can skip with zero courses, return on another browser, and enter the dashboard without repeating onboarding. If they added two courses before skipping, those two courses remain available.

## 4. Remove written answers completely; keep answered status

Questions are answered verbally by the professor. The application should record whether a question has been answered, without storing a written response.

- Remove the written-answer field and its save action from professor question cards.
- Remove the ability to create, edit, save, retrieve, or display written answers.
- Existing written-answer text must be removed from the application database as part of this change. Hiding the field is insufficient.
- Preserve the questions themselves, their votes, and their answered/unanswered state.
- Keep **Mark answered**, **Mark unanswered**, and the **Answered** tab.
- Mark answered moves a question from Open to Answered.
- Mark unanswered moves it back to Open.
- Student cards and lecture history continue to show the appropriate status.
- Remove text such as “no written answer was saved,” “Awaiting an answer,” and other wording that implies a written response is expected.
- Expanding a professor question may still reveal useful existing details, such as submission time or report count.

**Acceptance:** A professor can mark a question answered without entering text. Its status updates for students and in history. No written-answer text remains stored or displayed.

## 5. Remove the Deleted tab and make professor deletion permanent

- Remove the professor’s **Deleted** tab.
- Remove the associated restore, trash-browsing, and empty-trash interactions.
- Keep single-question Delete available on professor question cards, including Answered questions.
- Retain a confirmation prompt before deletion. It must identify the question and clearly state that deletion is permanent.
- Confirming permanently removes the question and its associated question-specific records, such as votes and reports.
- There is no Undo or Restore opportunity.
- After deletion, the question disappears from professor and student views, relevant counts, and lecture history.
- Canceling the confirmation leaves the question unchanged.
- If deletion fails, show the failure accurately and allow retry.
- Previously deleted questions must not reappear as a side effect of removing the Deleted tab.

**Acceptance:** After a professor confirms deletion, the question remains absent after refresh and cannot be recovered through the app.

## 6. Add “Clear all questions” for all Open questions in the current lecture

The requested button label is **Clear all questions**. Its scope is specifically **all Open questions in the current lecture**.

- Make the action available alongside the professor’s Open-question controls.
- Clear every question belonging to the Open tab in the current lecture, including questions hidden by the selected time filter.
- Preserve Answered questions.
- Preserve questions in other lectures.
- Use permanent deletion, with no Undo or Restore opportunity.
- Require a confirmation prompt that clearly states:
  - The current lecture’s name.
  - How many Open questions will be deleted.
  - That the action includes Open questions hidden by the time filter.
  - That Answered questions will remain.
  - That deletion is permanent.
- Suggested confirmation wording:

  “Permanently delete all {count} open questions from {lecture name}? This includes questions outside the selected time range. Answered questions will remain. This cannot be undone.”

- Canceling performs no deletion.
- Disable the action when there are no Open questions in the lecture or while clearing is processing.
- If the filtered list is empty but older Open questions exist, the action remains available and its confirmation uses the full Open-question count.
- Clearing leaves the session running and preserves its existing Pool open/Pool paused state.
- Questions submitted after the clear action is confirmed remain available.
- Reflect the result in student views, professor views, and counts through the normal live updates. Report failures accurately.

**Acceptance:** A lecture contains eight Open questions and three Answered questions. The time filter shows only two Open questions. Confirming Clear all questions deletes all eight Open questions and preserves the three Answered questions.

## 7. Use the lecture name as the question-page heading

On the professor’s active question page:

- Replace **“Lecture questions”** with the actual name of the current lecture/session.
- Use the name assigned when that session was created. In the existing flow, this is the selected course name.
- This change does not introduce a separate session-naming step.
- Remove the repeated course name and start timestamp beneath the heading.
- Keep the pool-status badge beneath the heading:
  - **Pool open** when submissions are accepted.
  - **Pool paused** when submissions are paused.
- Keep the existing **Show join code**, **Pause/Resume questions**, and **End lecture** controls.
- Accommodate long lecture names on desktop and mobile without obscuring the controls.

**Acceptance:** A session started for “HS26 Linear Algebra” displays that name as its heading, with the pool-status badge beneath it and no repeated name or start timestamp.

## 8. Make professor Past Lectures more compact

Compact both the outer lecture entries and the question cards inside them.

For lecture entries:

- Show a compact summary containing the lecture/course name, date and time range, total question count, and answered count.
- Avoid repeating the same course and lecture name when they are identical.
- Avoid redundant labels and repeated dates.
- Start with every lecture collapsed.
- Clicking a lecture summary expands or collapses its questions.
- Keep the most recent lectures first.
- Lecture entries with no remaining questions should still be visible as session records.

For the questions inside an expanded lecture:

- Show the question text with a small **Answered** or **Unanswered** status.
- Remove written-answer content and explanatory answer placeholders.
- Reduce excess padding and spacing while preserving readability.
- Keep the full question text readable, including long questions.
- Show a concise empty state when the lecture contains no questions.

**Acceptance:** Opening Past Lectures shows a compact list of collapsed lecture summaries. Expanding one reveals readable, compact question cards and their statuses.

## 9. Add courses directly from “Choose a course” and simplify the page

- Add a visible **Add course** action to the existing course-selection page.
- Activating it reveals a small course-title form on that same page.
- Apply the same title validation as onboarding and Settings.
- Successfully adding a course:
  - Saves it to the professor’s persistent course list.
  - Makes it available in Settings and on other browsers/devices.
  - Selects it in the course chooser.
- Adding a course does not start a lecture. The professor must explicitly click **Start session**.
- Canceling course creation discards the unfinished draft.
- A successfully saved course remains saved even if the professor subsequently leaves the chooser without starting a session.
- Support an initially empty course list with a clear way to add the first course.
- Keep Start session unavailable until a valid course is selected.
- Remove introductory and helper descriptions, including the explanation that courses came from setup.
- Keep the page title, essential labels, navigation, validation errors, and concise empty-state guidance.
- Once Start session succeeds, preserve the existing flow to the session’s join-code/invitation screen.

**Acceptance:** A professor who skipped onboarding can add a course here, see it selected, and then start the session with a separate click.

## 10. Replace professor sorting controls with a time filter

The time filter appears **only for professors** and affects **only the Open tab**.

Use these choices:

| Choice | Meaning |
|---|---|
| All questions | Every Open question in the current lecture |
| Last 5 minutes | Open questions submitted within the preceding five minutes |
| Last 10 minutes | Open questions submitted within the preceding ten minutes |
| Last 15 minutes | Open questions submitted within the preceding fifteen minutes |
| Last 30 minutes | Open questions submitted within the preceding thirty minutes |

Behavior:

- Default to **All questions**.
- Present the control as a time filter, replacing the existing sorting menu.
- Use each question’s original submission time to determine inclusion.
- The time window moves continuously as time passes. Questions age out even if no new submissions or votes arrive.
- Voting on an older question does not make its submission recent again.
- Marking an old Answered question unanswered also preserves its original submission time.
- Rank qualifying questions automatically by their total current votes, highest first.
- For equal vote totals, older submissions come first. Completely tied questions should maintain a stable order.
- Refresh the ranking as votes change.
- Calculate the Open-tab count and existing Top voted badges from the filtered Open-question list.
- The Answered tab retains its complete list and full count. It has no time filter and continues to use vote-based ordering.
- Returning from Answered to Open retains the selected filter for the current lecture.
- Starting a new lecture resets the filter to All questions.
- Changing the filter affects only that professor’s view. It does not delete questions or change what students see.
- When no questions match a selected time range, explain that the filtered view is empty and provide a clear way to return to All questions.

**Acceptance:** A six-minute-old question disappears from Last 5 minutes, remains available under All questions, and still exists for students. A new vote on it does not bring it back into Last 5 minutes.

## 11. Implement professor course Settings and persistent profiles

Each professor must have a profile saved in the database and associated with their signed-in account.

The profile must retain:

- Their course list.
- Course names and ordering.
- Whether onboarding has been completed or skipped.

The same profile must be used by onboarding, Settings, and the course chooser.

Course management in Settings must support:

- **Add:** Create a course.
- **Rename:** Change a course’s name for future sessions.
- **Remove:** Remove a course from future selection.
- **Reorder:** Change the order used in Settings and the course chooser.

Shared rules:

- Preserve the existing title rules: trim surrounding whitespace; reject blank titles; allow up to 120 characters; reject duplicate names within the professor’s list after trimming and ignoring case.
- Different professors may have courses with the same name.
- Keep controls understandable on desktop, touch devices, and with keyboard navigation.
- Make saving and failure states clear. Do not report a change as saved before it has persisted.
- Reflect successful changes throughout the current professor space without requiring the user to repeat setup.
- Another browser or device signed into the same account must load the saved profile and course list.
- Separate professor accounts must retain separate profiles.
- An empty course list is valid. Removing the final course leaves onboarding completed and lets the professor add courses later.
- A profile-loading failure must show an error/retry state. It must not be treated as a new professor with no saved data.

Course changes and lecture history:

- Renaming a course affects only future sessions.
- Running and past lectures retain their existing names.
- Removing a course preserves its running and past lectures, questions, and answered statuses.
- Removing a course used by a running lecture does not end that lecture.
- Reordering courses changes selection order, not lecture history.

Transition from the current browser-only course list:

- Carry forward a valid existing course list and onboarding completion state when creating that professor’s database profile.
- Once a database profile exists, treat it as authoritative. An older browser-local copy must not silently overwrite it or resurrect courses removed elsewhere.

This scope adds persistent professor profiles and course management; it does not require additional personal-profile fields.

**Acceptance:** A professor adds and reorders courses on one browser, then sees the same saved list on another. Renaming or removing a course changes future session choices while existing lecture names and history remain intact.

## 12. Separate students’ own questions and explain the self-vote restriction

Question lists:

- **Your questions** contains only questions submitted by the signed-in student.
- **Other Questions** contains only questions submitted by other students.
- Apply this separation on desktop and mobile, for every question status.
- Preserve newest-first ordering in Your questions.
- Show an appropriate empty state when either list has no questions.

After successful submission:

- On mobile, automatically switch to Your questions.
- Make the new question visible and briefly highlight it.
- On desktop, make the new card visible in Your questions and highlight it there.
- Clear the composer after successful submission.
- If submission fails, retain the draft and show the error. Do not display a falsely successful question card.

Own-question vote control:

- Continue showing the number of votes received from other students.
- Do not allow the author to upvote their own question.
- Show this exact explanation:

  “You are not allowed to upvote your own question”

- Make the explanation available on mouse hover, keyboard focus, and tapping the non-voting control on touch devices.
- These interactions must not alter the vote total or submit a vote.
- Keep self-voting prevented beyond the visual control as well.
- Preserve the existing ability to upvote and remove an upvote from other students’ questions.

**Acceptance:** A student submits a question and immediately sees it under Your questions. It is absent from their Other Questions list but visible to another student. Interacting with its own-question vote control explains the restriction without changing the count.

## Shared completion criteria

- All affected flows work on desktop and mobile, including long names and question text.
- Loading, empty, saving, success, and failure states remain understandable.
- Confirmation prompts clearly describe destructive actions; cancellation changes nothing.
- Live question lists, counts, and statuses converge across professor and student views after changes.
- Necessary tutorial text, interface copy, and instructional images are updated wherever these changes make them inaccurate.
- Verify persistence with independent browser sessions using the same professor account, and verify account separation with different accounts.
- Verify the combined workflow: skip onboarding → add a course → start a lecture → submit and vote as students → filter Open questions → mark one answered → clear the remaining Open questions → end the lecture → inspect its compact history.
- Verify that course edits preserve existing lectures, written answers are removed from storage, and permanently deleted questions do not return after refresh.
