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
