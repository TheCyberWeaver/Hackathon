# AskPool entry page integration

The entry page is `/`. It reads the signed-in user from `GET /api/me` and opens
`/student` or `/professor`. Both dashboards live in the same Vite app under
`frontend/src/student/` and `frontend/src/professor/`. A reload on either route
checks identity again. Vite and Caddy use an SPA fallback for dashboard routes.

The student dashboard uses the Node demo API at `frontend/server/student-api/`
for questions, votes, and reports. Its client makes same-origin requests without
creating a browser identity or sending trusted user headers. In production, the
managed proxy supplies `X-User-Id` to the API. The professor dashboard still
uses mock questions and past lectures, so its data is not shared with students.

Choosing Student or Professor is demo navigation, not an authorization grant.
Real professor permissions and lecture ownership must be enforced by the
backend. The current “Log out” controls return to the entry page; the managed
login portal must handle actual sign-out when it is integrated.

## Identity endpoint

Spring reads `X-User-Id` as the unique identifier and percent-decodes
`X-User-Name` using UTF-8. Missing or blank identity returns HTTP 401.
Successful responses have `Cache-Control: no-store` and this shape:

```json
{ "id": "alex@ethz.ch", "name": "Alex Morgan" }
```

## Local development

Run `npm run dev` from `frontend/`. This starts Vite on port 5173 and the student
demo API on port 3001. Vite serves a fictional `Alex Morgan` identity in
development, so both dashboards can open without Java on port 8080. Set
`ASKPOOL_DEMO_AUTH=false` in `frontend/.env.local` to require the backend
identity instead. This simulation is absent from production builds and
`vite preview`.

To change the preview identity, set `ASKPOOL_DEMO_USER_ID` and
`ASKPOOL_DEMO_USER_NAME` in `frontend/.env.local` and restart Vite. Keep
`VITE_API_BASE_URL` empty when using the development proxy.
