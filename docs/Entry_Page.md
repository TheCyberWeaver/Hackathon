# AskPool entry page integration

The entry page is `/`. Its visible UI is only the AskPool name and two buttons:
Student and Professor. It reads the signed-in user's identity from `GET /api/me`
and provides two navigation destinations: `/student` and `/professor`.

## Dashboard handoff

`frontend/src/App.tsx` loads the profile and selects a destination based on the
pathname. Replace `DashboardEntry` with the independently developed dashboard
components at those two integration points. The profile is passed as a `user`
prop with `{ id: string, name: string }`. The default destination components are
small coming-soon pages, not dashboard implementations. Links work on reload
because Vite and the deployment's Caddy configuration use an SPA fallback.

Choosing student/professor is a demo navigation choice, not an authorization
grant. Both options are available to every authenticated user. Dashboard teams
must enforce any real professor privileges and lecture ownership in the backend.

## Identity endpoint

Spring reads `X-User-Id` as the unique identifier and percent-decodes
`X-User-Name` using UTF-8, preserving literal `+` characters. Missing or blank
identity returns HTTP 401. Missing or malformed names fall back to the identifier.
Successful responses have `Cache-Control: no-store` and this shape:

```json
{"id":"alex@ethz.ch","name":"Alex Morgan"}
```

The frontend disables entry buttons while checking identity. Without an identity,
either button opens the matching path through the managed login portal. After a
connection failure, an entry button retries the profile request before navigating.
Status updates are provided to screen readers without adding visible UI.
React receives identity from `/api/me`; it does not
create or send the proxy identity headers. Keep production behind the managed
address with login enabled and the Java backend port unpublished.

## Local demo

Start the backend and frontend using the existing VS Code `Dev: start both`
task, or `backend/gradlew.bat bootRun` and `npm.cmd --prefix frontend run dev`
in separate terminals. Use JDK 21 with a valid `JAVA_HOME`.

The Vite development proxy supplies `alex@ethz.ch` / `Alex Morgan` by default.
This simulation is development-only; it is absent from production builds and
`vite preview`. The profile appears on the dashboard handoff pages.

To change the preview identity, put these variables in `frontend/.env.local`
and restart Vite:

```dotenv
ASKPOOL_DEMO_USER_ID=zoe@ethz.ch
ASKPOOL_DEMO_USER_NAME=Zoë Müller
```

Set `ASKPOOL_DEMO_AUTH=false` to preview the missing-identity state. Stop the
backend to preview the connection error and retry flow. Keep `VITE_API_BASE_URL`
empty when using the development proxy.
