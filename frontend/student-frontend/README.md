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
