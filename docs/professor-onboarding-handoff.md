# Professor onboarding: implementation and integration handoff

The `professor-onboarding` branch contains a frontend prototype of the first-entry professor flow. It also merged the available `origin/main` before implementation because the branch's previous professor dashboard could not build. The onboarding is independent of the lecture API and makes no backend schema changes.

## What this branch does

When `frontend/src/App.tsx` has loaded the signed-in user from `GET /api/me`, `ProfessorSpace` checks for a completed profile. If none exists, every `/professor` route shows `frontend/src/professor/ProfessorOnboarding.tsx` instead of the dashboard. This includes direct URL navigation. The welcome uses `user.name`; the storage key uses `user.id`. There is currently no professor role check, so any demo user who enters the professor area can see it.

The flow is a responsive full page: animated welcome, course setup, and success message. There is no separate question slide. Motion is reduced when the browser requests reduced motion. A professor can add with the right-hand **+** button or Enter, rename by selecting a title, remove, and reorder courses. The six-dot handle supports pointer dragging on desktop and touch screens; keyboard users can focus that handle and press Arrow Up/Down. Separate reorder buttons and row numbers are removed. The list scrolls when it grows. Course titles are trimmed, blank or duplicate titles are rejected without regard to case, and input is limited to 120 characters.

### Visual sequence (revised after review)

- The welcome sits slightly above the page centre and fades in, holds, and fades out over 2200 ms, with a subtle 14 px upward movement on entry and exit. Its CSS animation ending advances to course setup, so React does not replace still-visible text on an independent timer.
- Course heading and supporting text fade in over 980 ms in their final positions. The underline and form begin 500 ms after the text starts and fade in over 1120 ms. The hidden form reserves its layout space and cannot receive focus before its reveal, avoiding a heading jump.
- Done saves immediately, then the form fades out over 300 ms before success fades in over 550 ms (850 ms total, shortened again after annotation review). The outgoing form is inert to prevent duplicate edits/submission. Reduced motion skips these delays; changing the preference during welcome or the exit also advances safely.
- The upper-left wordmark matches the dashboard's `.side-panel-brand` typography. There is no logo icon, upper-right label, blue text above headings, or lower-left slogan. The remaining lower-right label is faint, and the background is plain.
- Timing/keyframes live in `professorOnboarding.css`; stage transitions live in `ProfessorOnboarding.tsx`. Course data and the JSON contract are unchanged by this visual revision.

**Done** is enabled after at least one valid course is present and any draft or rename is resolved. It writes the entire JSON profile in one local-storage operation and then shows “You’re all set.” If writing fails, the professor stays on the course step with an error, and onboarding remains incomplete. **Continue to dashboard** opens `/professor`. Reloading after Done also goes to the dashboard, because Done already marked completion. An unfinished draft is never stored; leaving before Done restarts onboarding. There is no production skip or replay. Settings is intended to be the only way to change courses later; the colleague's course editor is still pending. The existing Settings placeholder has a development reset control described below.

The student tutorial chat was a visual reference for smooth animation and mobile polish. This onboarding is live form UI, not a screenshot carousel.

After annotation review, the success page no longer exposes a JSON download. Done still saves the same formatted JSON in browser storage, and `serializeProfessorProfile` remains the shared serializer for integration. The synthetic `.json` example below documents the contract. The decorative left-hand plus, input hint, and footer status text are also removed; validation errors remain visible. Success copy reads “You can always make changes in the Settings.”

## Files to start from

| File | Responsibility |
| --- | --- |
| `frontend/src/App.tsx` | `ProfessorSpace` checks completion after identity loads and gates professor routes. |
| `frontend/src/professor/ProfessorDashboard.tsx` | Development-only reset control at the bottom-right of Settings; invokes the reset callback from `ProfessorSpace`. |
| `frontend/src/professor/ProfessorOnboarding.tsx` | Welcome/name insertion, in-memory draft, editing, ordering, Done and Continue. |
| `frontend/src/professor/professorOnboarding.css` | Scoped full-page desktop/mobile styles and reduced-motion behavior. |
| `frontend/src/professor/professorProfile.ts` | Shared types, validation, JSON serialization and replaceable storage functions. |
| `frontend/scripts/professor-profile.test.mjs` | Persistence contract tests; run `npm run test:professor-profile`. |
| `docs/professor-onboarding-profile.example.json` | Synthetic example for Settings/QR integration. |

The feature is lazy-loaded separately from both dashboards. The existing professor dashboard was supplied by the local merge of `origin/main` (`5cb26d5`); onboarding does not change its lecture creation logic.

## JSON data contract

The exact example is [professor-onboarding-profile.example.json](professor-onboarding-profile.example.json). The runtime value has this shape:

```json
{
  "schemaVersion": 1,
  "professorId": "alex@ethz.ch",
  "onboardingCompleted": true,
  "courses": [
    { "id": "c84e7a21-7354-4ab3-81b4-69baabfbf067", "title": "HS26 Linear Algebra" },
    { "id": "7399d478-c060-448b-bf55-c2e9fd56eb06", "title": "HS26 Discrete Mathematics" }
  ]
}
```

- `professorId` is the `id` from `/api/me`. The name is display-only and is not stored.
- Each course gets a UUID when added. Keep its ID when renaming or reordering. Delete the object when removing a course.
- `courses` array order is the saved course order. There is no separate position field.
- Titles are trimmed before saving and must be nonempty, at most 120 characters, and unique after case-insensitive comparison. Internal whitespace is preserved.
- This prototype requires at least one course in a completed profile. If Settings must allow removal of the final course, update validation without resetting completion or triggering onboarding again.
- `onboardingCompleted` is `true` only after a successful Done. Settings must keep this flag `true` when changing courses.

The source of truth for the prototype is `frontend/src/professor/professorProfile.ts`. It exports `ProfessorProfile`, `ProfessorCourse`, `professorProfileStorageKey`, `readProfessorProfile`, `saveProfessorProfile`, and `serializeProfessorProfile`. The local-storage key is `askpool:professor-onboarding:v1:${encodeURIComponent(professorId)}`. Its value is a formatted JSON string with the shape above. Settings can use the same functions to read and update the ordered course list in this browser. The serializer returns `null` for invalid data, the reader returns `null` for missing/invalid/unavailable storage, and the writer returns `false` without changing completion if validation or storage fails. The example `.json` file documents the contract; it is not a runtime record and must not be edited with real professor data.

## Limitations and next integration

**Once across all devices is not implemented.** Browser local storage is scoped to one browser profile and origin. Clearing it, changing devices, or using another browser repeats onboarding. The frontend cannot write a runtime `.json` file to the repository or share this state across devices. The merged `main` has PostgreSQL for lecture data, but there is no account-backed professor profile/course API yet.

Courses are not yet connected to dashboard lectures, Settings, or QR generation. The successful save means the ordered course JSON and completion flag are stored in the browser. The UI's Settings wording describes the agreed final workflow; its integration belongs to the colleague's work. There is no cross-tab synchronization, and drag ordering does not auto-scroll the list; scroll the list between moves or focus a drag handle and use the arrow keys for longer moves. Mobile checks used browser touch emulation, not a physical phone.

The integration contributor should:

1. Add durable account storage for this JSON shape, keyed by the trusted professor identity. Read completion and courses from the server before deciding whether to render onboarding, and persist the valid ordered courses and completion flag atomically on Done. The server must derive `professorId` from authenticated identity, not trust a browser-supplied ID. An API such as `GET/PUT /api/professor/profile` can preserve the same shape; a missing profile means onboarding is required.
2. Have Professor Settings read and update the same ordered `courses` array and retain course IDs. The QR workflow should refer to a course by stable ID and display its title. Replace the local-storage functions in `professorProfile.ts` with the shared API client or a wrapper used by onboarding and Settings.
3. Gate the professor area using real professor permissions when they become available in `main`. The present entry page and development identity do not enforce roles.
4. Decide how existing professors with saved courses but no completion flag are migrated. They should not be asked to recreate their courses accidentally.

The server integration will be asynchronous: replace `ProfessorSpace`'s synchronous initial storage read with loading/ready/error states, and make Done await a successful server save before showing success. Disable repeat submission while saving. A failed profile request must show a retry state; it must not be treated as a missing profile and overwrite existing courses. No permanent backend identifier should be derived from the professor's display name. Keep using `/api/me`'s name for the welcome; replace only that adapter if the eventual login response changes.

## Local verification

Run the current local stack as described in `docs/Local_Development.md`, then visit `/professor` with an identity that has not completed setup.

During development, open Professor Settings and use **Reset onboarding (dev)** at the very bottom-right. It calls `resetProfessorProfile(user.id)` to remove that professor's saved courses and completion flag, switches the `ProfessorSpace` gate back to incomplete, and navigates to `/professor` for a fresh welcome and empty form. It does not save a replacement course list. A failed storage removal leaves the dashboard open with an error. Only this professor's onboarding storage key is removed; other accounts, browser preferences, and backend lecture/question data remain intact. Both the control and callback are gated with `import.meta.env.DEV`; the control is excluded from production JavaScript. When merging the real Settings page, retain this as a dev-only control rather than exposing replay to professors.

Alternatively, remove only the current identity's key in the console, for example `localStorage.removeItem('askpool:professor-onboarding:v1:alex%40ethz.ch')`, and reload.

Run `npm run build`, `npm run lint`, `npm run test:professor-profile`, and `npm run format:check` in `frontend/` after changing this code. The `professor-onboarding` branch's pre-merge professor dashboard did not compile; the merge from `origin/main` supplied the current working professor flow.

### Verified on 2026-10-10

- Production build and ESLint: passed.
- Profile contract tests: all six cases passed (seven Node test entries including their parent). Covers account separation, stable IDs/order, invalid updates, corrupt/incomplete/future-schema data, example JSON compatibility, targeted reset and unavailable storage.
- Local Chrome automation: welcome/course stages, reduced motion, direct professor subroutes, draft abandonment, trimming, duplicate add/rename, empty rename, Escape cancellation, removal, pointer/touch ordering, long-list scrolling, blocked-storage error, Done completion, Continue and reload skipping all passed. No uncaught browser errors in the primary flow.
- After the visual revision: build/lint passed again; verified the welcome placement, removed labels/second slide, delayed form reveal, unchanged heading position during reveal, inert fade-out after Done, success/Continue, reduced motion, and layouts at 320/390/768/1440 px. New desktop/mobile screenshots were visually inspected.
- After the timing/reset revision: build, lint and profile tests passed. Browser checks verified the exact animation durations, 500 ms stagger, increased welcome movement, Settings reset placement on desktop/mobile, reset failure recovery, empty onboarding after reset/reload, and preservation of unrelated storage. Production JavaScript was checked to exclude the development reset UI.
- Desktop and mobile screenshots visually inspected; overflow checks passed at 320, 390, 768 and 1440 px widths. Fixed a focus/drag clipping issue by preventing the decorative page container from becoming a scroll container.
- Formatting: onboarding files pass. Full `npm run format:check` still reports the existing `frontend/src/student/components/QuestionCard.tsx`, which this feature does not modify.

- After annotation cleanup: build and lint passed; browser checks verified all requested removals, the accessible plus button, Enter-to-add, duplicate validation, keyboard/pointer reordering, 300/550 ms completion fades, corrected copy, saved JSON ordering and Continue. Desktop/mobile form and mobile success screenshots were visually inspected.

For a manual acceptance pass, start with a fresh demo identity, abandon one draft and return, create two courses, try a duplicate, rename and reorder them, then click Done. Inspect the identity's JSON in browser local storage and confirm the array matches the visible order and IDs survive rename/reorder. Continue should open the existing professor page, and a reload after Done should skip onboarding.
