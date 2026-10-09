# API contract

## GET /api/hello

No authentication, query parameters or request body are required.

Successful response: HTTP 200, Content-Type application/json.

```json
{ "message": "Hello from Java 21" }
```

The message field is a string. The frontend checks both HTTP status and this shape, then displays loading, success or error states. Extend the contract here before implementing new features.

Local browser URL: http://localhost:5173/api/hello (proxied to Java). Direct API URL: http://localhost:8080/api/hello. The frontend sends no cookies or authorization headers.
