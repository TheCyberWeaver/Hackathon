# AskPool student demo

This is the separate student-facing clickable demo. Its small Node server stores preset questions, submitted questions, votes, and reports locally. It is independent of the shared frontend starter and the real backend.

## Run

```bash
cd frontend/student-frontend
npm install
npm run dev
```

Open `http://localhost:5174`. The Vite output also shows a **Network** URL; open that URL on a phone connected to the same network. The app proxies API requests to the local demo server on port 3001, so both processes must be running. Allow local network access through your firewall if prompted.

Each browser gets its own local student ID. Questions and votes survive reloads in `server/data/state.json`.

```bash
npm run reset-data  # restore the original questions and clear student activity
npm run build
npm run lint
```

The API is isolated in `src/lib/studentApi.ts` for later replacement. This demo does not use the Java backend.

## Edit demo content

- **Preset questions:** Edit, add, or remove entries in `server/seed.json`. Then run `npm run reset-data` and refresh the page. Resetting also clears submitted questions, votes, and reports.
- **Current saved questions:** Edit `server/data/state.json` and refresh the page. Remove a question's full object from the `questions` array to delete only that question. This file is created on first run, is Git-ignored, and is overwritten by `npm run reset-data`. Keep the JSON valid. There is no student-facing delete control in this demo.
- **Visible interface text:** Edit `src/App.tsx` for headings, example placeholders, the anonymity note, empty state, dialog, and toasts; `src/components/QuestionCard.tsx` for status and report labels; and `src/components/ViewSwitchButton.tsx` for switch labels. Server error messages live in `server/index.mjs`.
- **Appearance and spacing:** Edit `src/styles.css`; the color tokens are at the top of that file.
