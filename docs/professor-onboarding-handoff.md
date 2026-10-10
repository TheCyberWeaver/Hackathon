# Professor setup and course persistence

The current implementation follows [AskPool_Product_Changes.md](AskPool_Product_Changes.md). This document supersedes the earlier browser-only onboarding handoff.

`ProfessorOnboarding.tsx` retains the welcome animation, Enter-to-add, course title validation, rename, remove and drag/keyboard reordering. The add control visibly says **Add**. **Done** includes a valid unfinished course title; **Skip for now** retains only courses already added, including an empty list. Both save completion before entering the dashboard. Saving errors preserve all entered information and allow retry.

`profileApi.ts` loads the account's database profile through `/api/professor/profile/initialize`. `professorProfile.ts` contains shared title validation and the read-only legacy importer. The old `askpool:professor-onboarding:v1:{encoded identity}` key and `professor-onboarding-profile.example.json` describe migration input only. They are never used as the authoritative saved profile and are never written by the new app. Removing local storage does not reset onboarding.

The profile stores completion, a revision, and courses with stable IDs, titles and ordering. Settings and the chooser share the loaded profile and persist through the same callback. Stale concurrent updates return 409, load the latest profile, and ask the person to review/retry. Initialization cannot overwrite an existing database profile. Separate accounts are isolated even in local testing mode.

Course titles are trimmed, nonblank, at most 120 characters and unique after case-insensitive normalization. Different accounts can use the same titles. Empty lists remain valid after setup. Rename/remove/reorder affect future choices only; lecture names and history are independent snapshots.

Verification is reproducible through the frontend API/profile/view tests, PostgreSQL-backed ProfessorProfileTests, and Playwright desktop/mobile acceptance tests. Browser checks use isolated storage contexts sharing the same signed-in account, plus independent accounts and simulated failure responses. They do not replace physical-device or Safari/Firefox testing.
