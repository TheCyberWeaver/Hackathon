# AskPool entry page integration

The entry page is `/`. Its visible UI is only the AskPool name and two buttons:
Student and Professor. It reads the signed-in user's identity from `GET /api/me`
and provides two navigation destinations: `/student` and `/professor`.

## Connected dashboards

`frontend/src/App.tsx` loads the profile before opening either dashboard. The
Student button opens the existing student app at `/student`; its profile and
settings pages are `/student/profile` and `/student/settings`. The Professor
button opens the restored PR #2 dashboard at `/professor`. Both receive the
same signed-in user as `{ id: string, name: string }` and display that name and
email in their navigation drawers. Entry buttons and **Switch space** use
in-app navigation, retaining the profile loaded by the login page. Browser back
and forward work across both spaces. A page reload or direct dashboard URL
revalidates identity through `/api/me`; identity is not stored in localStorage.
Dashboard CSS loads with its own component so the
minimal entry page retains its appearance. Reloads use Vite/Caddy's SPA fallback.

The student app can still run independently on port 5174. The shared frontend's
`npm run dev` starts Vite on 5173 and the student's demo API on 3001; Java still
runs separately on 8080. `/api/me` goes to Java, while `/api/questions` and its
subpaths go to the demo API. The integrated demo API requires `X-User-Id` for
question ownership and voting; it ignores client-supplied `X-Student-Id` values.
When a login profile is provided, the student client makes same-origin requests
without generating a browser ID or sending any identity headers. The managed
proxy supplies the same `X-User-Id` used by `/api/me` on each API request.
Standalone mode retains its original per-browser demo identity. Run only one
copy of the student demo API on port 3001 at a time.

Professor question data remains the existing in-memory mock demo. Student
questions use the existing Node demo store. This connection does not combine
the two question data models or implement a production question backend.

Choosing student/professor is a demo navigation choice, not an authorization
grant. Both options are available to every authenticated user. Dashboard teams
must enforce any real professor privileges and lecture ownership in the backend.

## Identity endpoint

Spring reads `X-User-Id` as the unique identifier and percent-decodes
`X-User-Name` using UTF-8, preserving literal `+` characters. Missing or blank
identity returns HTTP 401. Missing or malformed names fall back to the identifier.
Successful responses have `Cache-Control: no-store` and this shape:

```json
{ "id": "alex@ethz.ch", "name": "Alex Morgan" }
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
`vite preview`. The profile appears in the dashboard navigation drawers.

To change the preview identity, put these variables in `frontend/.env.local`
and restart Vite:

```dotenv
ASKPOOL_DEMO_USER_ID=zoe@ethz.ch
ASKPOOL_DEMO_USER_NAME=Zoë Müller
```

Set `ASKPOOL_DEMO_AUTH=false` to preview the missing-identity state. Stop the
backend to preview the connection error and retry flow. Keep `VITE_API_BASE_URL`
empty when using the development proxy.
