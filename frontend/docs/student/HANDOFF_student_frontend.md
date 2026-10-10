# Handoff to Codex: AskPool student frontend (clickable demo)

> Historical design brief. The implemented student dashboard now lives in
> `frontend/src/student/`, and its demo API lives in `frontend/server/student-api/`.
> The paths and setup commands below describe the original standalone prototype.
> For the current setup and behavior, use `frontend/README.md` and
> `docs/Entry_Page.md`. In the current app, votes always outrank submission time,
> and professors may see question authors.

Archived status: v3 design brief (2026-10-10). It is retained for background and
does not override the current implementation or documentation.

**Goal of this task in one sentence:** a polished, clickable student-side demo that the rest of the team can open to see how AskPool would look and feel on mobile and desktop. Visual and interaction fidelity matters far more than completeness or architecture.

---

## 1. What the project is

**AskPool** is a live classroom Q&A platform. Students join a lecture session by QR code or link, ask questions **anonymously** into a shared pool, and **upvote** questions they also want answered. Questions are ranked by votes and submission time. A professor works through the pool on a separate dashboard and marks questions selected or answered.

Pitch: _An anonymous classroom question pool where students ask, classmates vote, and professors respond to what matters most._

Product rules (from `Project_Guideline.md`) that matter for the student UI:

- Questions are anonymous to classmates and the professor.
- One vote per student per question.
- Question statuses: `open`, `selected`, `answered`.
- Students can report spam or abuse; a report only flags the question and never reveals the author.

Demo decision: the UI simply says the experience is **fully anonymous**. Do not add text about moderators or reveal exceptions.

## 2. Scope

**In scope: the student-facing frontend only**, plus a **very thin demo server** (section 7) that serves preset questions and remembers what the student sent and voted.

**Out of scope, owned by teammates, do not build or touch:** the professor dashboard, the database, and the real Java backend in `backend/`. These are **not being combined yet**. The thin demo server in this task is throwaway scaffolding that lives inside the student app folder and must not modify `backend/`.

## 3. Repository and stack

Repo root: `Hackathon/` (React 19, TypeScript, Vite, Tailwind CSS v4, ESLint, Prettier). The starter in `frontend/src/` (hello-world page, indigo styling) is the shared starter; **leave it untouched**.

Build the student app as its own **separate Vite app** in `frontend/student-frontend/` (currently only `demo_sketch.pdf` and a stub README):

- Own `package.json`, `vite.config.ts`, `tsconfig*`, ESLint and Prettier config, copied from `frontend/` and adapted.
- React 19 + TypeScript + Tailwind v4 utilities, no UI kit. Keep extra dependencies minimal. Animations are CSS transitions or a small `requestAnimationFrame` helper, no animation library. `concurrently` (or a tiny Node script) is fine for starting app and server together.
- Dev port **5174** for the app (so it runs next to other apps), demo server on **3001**.
- `npm run build` and `npm run lint` must pass with zero warnings. Format with Prettier.
- Vite must be reachable from other devices on the network (`server.host: true`) so teammates can open it on their phones.

Source of truth for layout and behavior: `frontend/student-frontend/demo_sketch.pdf` (hand-drawn; red text is annotations). This handoff transcribes it. If anything seems to conflict, follow this file.

## 4. Visual direction (overrides the sketch's look)

The sketch defines **layout and behavior only**. Styling:

- **Light theme only**, no dark mode.
- **Blue accent.** Define as CSS variables in the Tailwind `@theme`; never hardcode hex in components:
  - accent `#2563eb` (blue-600), hover `#1d4ed8`, soft tint `#eff6ff`, ring `#bfdbfe`
  - page background `#f7f8fc`, surface white, border slate-200, text slate-900, secondary text slate-500, placeholder slate-400
- No indigo anywhere in the new app.
- Calm, rounded, spacious. Large input with about 20px radius; cards with 1px slate border and a very light shadow; no heavy gradients. Font: Segoe UI / system stack as in the starter, headline weight 600.
- Simple outline icons as inline SVG (sidebar panel, arrow-right, thumbs-up, left-right arrows, more). No icon library.
- Liked state = filled accent thumb inside an accent-tinted box. Unliked = outline slate thumb inside a white bordered box.

## 5. Screens and behavior

Design mobile first at **390x844**, then desktop at **1920x1080**. The scrollable questions page and the settings placeholder share one left sidebar overlay. Same behavior on both unless stated.

### 5.1 Resting state

- Top-left: **sidebar trigger** (panel icon), same on mobile and desktop.
- **Greeting heading**: "What's your question?" Static text.
- **Question input** below it with a greyed-out **example question** as placeholder, e.g. "Why does the pumping lemma not apply here?". Default: one random example from a list of about 6 per page load.
- Mobile vertical placement: heading plus input sit between **1/3 and 1/2 of the viewport height**.
- At the bottom, the **"Other Questions" header with an underline** peeks into view to signal there is more below.

### 5.2 Sidebar

- Tapping the trigger opens a sidebar **over the left part of the screen (about 60% of width on mobile)**. The rest is **dimmed** with a scrim. Tapping the scrim or the trigger closes it.
- Duplicate the trigger and ASKPOOL wordmark: one pair stays anchored to the questions/settings page, and the other stays inside the sidebar as it opens. The wordmark returns to the Current Lecture page.
- Near the top, a highlighted **Current Lecture** link opens `/`. At the bottom, a divider separates a profile box containing the student avatar, **Student** label, and a gear icon. The gear opens the separate settings placeholder at `/settings`; a **Log out** button sits below the profile box. Log out is a no-op until authentication is added; the `handleLogout` function is the insertion point. The sidebar stays consistent on both pages. The former Profile page and the separate Profile and Settings sidebar links are removed. Browser Back and Forward restore the corresponding page.
- Animation: **fade in, out-quadratic, 250 ms**.
- Desktop: same overlay behavior, not a permanent column.

### 5.3 Typing state

Triggered when the input gets focus (on mobile, the keyboard opens).

- The textbox **moves up** so its top sits between **1/5 and 1/3 of the visible viewport height** (visible = above the keyboard; use `visualViewport`), then **expands downward with the length of the text** (auto-growing textarea). It also shrinks when lines are deleted and returns to its resting height as soon as a question is sent.
- Both movement and growth use **out-quadratic easing**.
- **Send button**: a circle with an arrow inside the textbox at the bottom right. Grey and disabled while empty; **lights up in the accent color once there is at least 1 character**.
- **Character counter** `n/200` under the send button. It **fades in linearly** as the user approaches the limit (not shown at the start; starts fading in at 80% of max). Hard stop at **200 characters**.
- A single quiet line of helper text near the input: "Fully anonymous." (shown when focused or always, designer's choice, keep it subtle).

### 5.4 After sending

Trigger: tap Send, then a **200 ms delay** before scrolling.

1. Immediately clear and collapse the input, and optimistically add the question to the **bottom of Other Questions** and to **Your questions**. Assume it got through for the UI reveal.
2. After the delay, scroll the page **all the way to the bottom** so the new question is visible there.
3. Scroll animation: **in-out quadratic, 1000 ms, slow and NOT interruptible** (ignore wheel, touch and keys for the full duration, then restore).
4. Check the server response after the animation. On failure, remove the temporary question and show a non-blocking error toast. The user can **always scroll back up** to ask more questions. Nothing stays locked afterwards.

### 5.5 Question lists

**Other Questions** (the shared pool, including the student's own questions):

- Header "Other Questions" with underline. On mobile a circular **switch button (left-right arrows)** at the right end of the header toggles the section to **"Your questions"** and back.
- Each **question card**: text on the left, **boxed thumbs-up icon and count side by side** at the existing right-side vote position. The student's own cards show a small **"Your Question"** label at the top left.
- **Voting is instant** (optimistic): the thumb fills and count changes on tap, before the server answers. On failure roll back and show a small toast.
- **At most one vote per question.** Tapping a liked thumb again removes the vote (toggle).
- Order: by rank from the server (votes first, older questions get a small boost). After a vote do not reshuffle abruptly; default is to keep order stable until the next load or until the user switches views, then animate reorder smoothly.
- **Status badges** (default, keep): `selected` shows a small accent "Being answered" pill, `answered` shows a muted check and sorts to the bottom.
- **Report**: a small "..." menu per card with "Report"; it opens a simple confirm sheet and then a toast "Thanks, we'll take a look." Purely a clickable demo, the server just records it.

**Your questions** (what this student has sent, loaded from the server so it survives a page reload):

- Same card layout, showing a **non-interactive like box** with the count (you cannot vote on your own question), the **"Your Question"** label, and the status badge.
- Newest first. A question the student just sent appears at the top with a brief highlight.

**Desktop layout (1920x1080):**

- Heading and input are **centered in a column about 60% of the width**, input at about **1/3 of the height**.
- "**Your questions**" at **2/3 to 3/4 of the height**, "**Other Questions**" below it, **both visible together** (no switch button on desktop; owner may change this later, so keep the switch as a separate component).
- **At 1080p, only a bit of the first Other Question is visible at the bottom edge**, as a peek inviting scroll. Verify at 1920x1080.
- Same animations and same send-then-scroll behavior as mobile.

### 5.6 Empty and error states

- No sent questions: "Questions you send will appear here."
- Request failure: non-blocking toast; optimistic changes roll back.
- No rate limiting in this version.

## 6. Feel (what matters most, ranked)

1. **Motion is the product.** Timings and easings in the sketch are deliberate. Implement exactly: sidebar 250 ms out-quad; textbox move and grow out-quad, with shrinking when content is removed; counter fade linear; send, 200 ms delay, then 1000 ms in-out-quad non-interruptible scroll to the page bottom. Reference curves: `out-quad = cubic-bezier(0.5, 1, 0.89, 1)`, `in-out-quad = cubic-bezier(0.45, 0, 0.55, 1)`. Respect `prefers-reduced-motion` by shortening to near-instant.
2. **Instant feedback on votes.** No spinners; thumb and count change on tap.
3. **Calm and safe to ask.** Minimal chrome, one clear action, friendly copy, visible "fully anonymous" reassurance.
4. **Mobile keyboard behavior is flawless.** No jump, no covered input, no iOS zoom on focus (input font-size at least 16px). Use `100dvh` and `visualViewport`.
5. **Looks good in a screenshot and in a live click-through.** This is shown to teammates; every button visible in the sketch must be clickable and do something sensible.
6. Basics: labelled controls, accent focus rings, 44px touch targets, `aria-live` for toasts.

## 7. Thin demo server and data layer

Purpose: let the team click through a believable demo with preset content, and make sure the student's own questions and votes are remembered. **Not** the real backend, and **not** to be merged into `backend/`.

**Implementation:** a dependency-free Node script (`node:http` and `node:fs`) at `frontend/student-frontend/server/index.mjs`, port **3001**. Vite proxies `/api` to it. State lives in `server/data/state.json`, created from `server/seed.json` on first start. `npm run reset-data` restores the seed. `npm run dev` starts server and app together.

**Student identity:** the browser generates a random id once, keeps it in `localStorage`, and sends it as header `X-Student-Id`. This makes "Your questions" and "voted" state per browser, so teammates on different devices each get their own. No login screen.

**Demo API contract** (a throwaway contract for this demo only; the real one will be agreed with the backend teammate later and recorded in `docs/API.md`):

| Method and path                  | Body                                             | Response                                                                                       |
| -------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `GET /api/questions`             | none                                             | `200` array of all questions, ranked, each with `mine` and `votedByMe` for the calling student |
| `POST /api/questions`            | `{ "text": string }` (1 to 200 chars after trim) | `201` the created question; `400` if invalid                                                   |
| `POST /api/questions/:id/vote`   | `{ "voted": boolean }`                           | `200` the updated question; one vote per student per question enforced server side             |
| `POST /api/questions/:id/report` | none                                             | `204`                                                                                          |

Question shape: `{ id, text, votes, createdAt, status: "open" | "selected" | "answered", mine: boolean, votedByMe: boolean }`.
Ranking: `score = votes + min(ageMinutes, 60) / 10`, descending; `answered` sorts last. Return the list already ranked.

**Frontend side:** the UI calls a single typed module, `src/lib/studentApi.ts`, exposing `listQuestions`, `submitQuestion`, `setVote`, `reportQuestion`. No component calls `fetch` directly, so the real backend can replace the server later by changing only that module. Do not call `/api/hello`.

**Seed data** (put in `server/seed.json`; createdAt spread over the last 5 to 40 minutes; votes as shown):

| Text                                                             | Votes | Status   |
| ---------------------------------------------------------------- | ----- | -------- |
| Could you go through the base case of the induction proof again? | 42    | open     |
| Is this going to be on the exam, or just the idea behind it?     | 37    | selected |
| What is the difference between a relation and a function here?   | 29    | open     |
| Why does the pumping lemma not apply to this language?           | 24    | open     |
| Can we see one more worked example of the greedy argument?       | 19    | open     |
| How do I choose the invariant for the loop?                      | 15    | open     |
| Does the order of the quantifiers really change the meaning?     | 12    | answered |
| Could the slides be uploaded before the lecture?                 | 9     | open     |
| What is the intuition behind the master theorem cases?           | 7     | open     |
| Is the recursion tree method rigorous enough for the exercises?  | 4     | open     |
| Sorry if this is basic, but what does "amortized" mean again?    | 3     | open     |
| Will the recording be available after the session?               | 2     | answered |

(Seeded questions are never `mine`. Seed does not use real people's names.)

## 8. Deliverable and acceptance checklist

A running app in `frontend/student-frontend/` with a short `README.md` (install, `npm run dev`, `npm run reset-data`, how to open on a phone via the network URL). Tick off:

- [ ] Separate Vite app on 5174, thin server on 3001, one command starts both
- [ ] Light theme, blue accent tokens in one place, no indigo
- [ ] Mobile (390x844) and desktop (1920x1080) match section 5
- [ ] Sidebar: left overlay at 60% phone width, dimmed rest, duplicated header controls, Current Lecture link, bottom Student card with Settings gear and Log out; questions and settings use separate URLs with shared navigation; 250 ms out-quad
- [ ] Textbox moves up, grows and shrinks with content, collapses on send, send lights up after 1 character, `n/200` counter fades in linearly, hard stop at 200
- [ ] Optimistic send places the question at the bottom of Other Questions and under Your questions; after 200 ms, the page scrolls to the bottom over 1000 ms without interruption; server result is checked after the reveal; scrolling back up works
- [ ] Mobile switch button toggles Other and Your questions; desktop shows both with a peek at 1080p
- [ ] Optimistic one-vote upvotes with rollback; vote state survives reload
- [ ] Sent questions survive reload and show under "Your questions"; preset questions and votes from the seed
- [ ] "Fully anonymous" note, status badges, report menu with confirm and toast
- [ ] `npm run build` and `npm run lint` pass
- [ ] No changes outside `frontend/student-frontend/`

Do not implement: professor features, moderation reveal, real auth, real QR scanning, rate limiting, simulated live activity, or anything in `backend/`.
