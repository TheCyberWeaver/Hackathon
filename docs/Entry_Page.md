# AskPool entry page integration

The entry page is `/`. It reads the signed-in user from `GET /api/me` and opens
`/student` or `/professor`. Both dashboards live in the same Vite app under
`frontend/src/student/` and `frontend/src/professor/`. A reload on either route
checks identity again. Vite and Caddy use an SPA fallback for dashboard routes.

Both dashboards use the Java PostgreSQL API for shared lecture questions,
votes, reports, and moderation. Clients make same-origin requests without
creating browser identities or sending trusted user headers. The managed proxy
supplies `X-User-Id`. See [the current API contract](API.md).

Choosing Student or Professor is demo navigation, not an authorization grant.
Professor permissions and lecture ownership are enforced by Java using
database roles. The current “Log out” controls return to the entry page; the managed
login portal must handle actual sign-out when it is integrated.

## Identity endpoint

Spring reads `X-User-Id` as the unique identifier and percent-decodes
`X-User-Name` using UTF-8. Missing or blank identity returns HTTP 401.
Successful responses have `Cache-Control: no-store` and this shape:

```json
{ "id": "alex@ethz.ch", "name": "Alex Morgan" }
```

## Local development

Run `npm run dev` from `frontend/`. This starts Vite on port 5173. Java on port
8080 and PostgreSQL are required for dashboard data. Vite serves a fictional
`Alex Morgan` identity in development; it defaults to a student. Set
`ASKPOOL_DEMO_AUTH=false` in `frontend/.env.local` to require the backend
identity instead. This simulation is absent from production builds and
`vite preview`.

To change the preview identity, set `ASKPOOL_DEMO_USER_ID` and
`ASKPOOL_DEMO_USER_NAME` in `frontend/.env.local` and restart Vite. Keep
`VITE_API_BASE_URL` empty when using the development proxy.
