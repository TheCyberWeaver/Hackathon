# API contract

## GET /api/me

Reads the managed proxy's `X-User-Id` and percent-encoded `X-User-Name` headers.
Returns HTTP 401 when the user identifier is absent or blank. On success, returns
HTTP 200 with `Cache-Control: no-store`:

```json
{ "id": "alex@ethz.ch", "name": "Alex Morgan" }
```

This identifies the user; it does not assign professor permissions. See
[entry page integration](Entry_Page.md) for dashboard handoff and local preview.

## GET /api/hello

No authentication, query parameters or request body are required.

Successful response: HTTP 200, Content-Type application/json.

```json
{ "message": "Hello from Java 21" }
```

The message field is a string. The frontend checks both HTTP status and this shape, then displays loading, success or error states. Extend the contract here before implementing new features.

Local browser URL: http://localhost:5173/api/hello (proxied to Java). Direct API URL: http://localhost:8080/api/hello. The frontend sends no cookies or authorization headers.

## Demo lecture sessions

The Node demo API handles `/api/sessions` using the trusted proxy's
`X-User-Id` header. All responses use `Cache-Control: no-store` and reject
requests without that identity. This demo does not verify professor permissions.

| Method and path               | Purpose                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| `GET /api/sessions/active`    | Active session owned by the caller, or `null`                  |
| `POST /api/sessions`          | Create a session from `{ "course": string }` (1–80 characters) |
| `DELETE /api/sessions/active` | End the session and invalidate its code                        |
| `GET /api/sessions/mine`      | Active session joined by the caller, or `null`                 |
| `DELETE /api/sessions/mine`   | Leave the lecture without ending it                            |
| `POST /api/sessions/join`     | Join an active session from `{ "code": string }`               |

Session responses contain `id`, `code`, `course`, and `startedAt`. Join codes
have eight unambiguous letters/digits in `XXXX-XXXX` form; input is
case-insensitive and the dash is optional. The QR encodes a same-origin
`/student/join?code=...` link. This is a demo join gate: question data is not
yet scoped to the session, and professor question cards remain mock data.
