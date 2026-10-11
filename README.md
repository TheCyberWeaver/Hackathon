# AskPool

AskPool is a classroom Q&A app with a React/Vite frontend, a Java 21 Spring Boot API, and PostgreSQL. A signed-in person can use both Student and Professor views. They can create lectures, join a live lecture with its six-character code or link, ask and vote on questions, and review their own history. Lecture management and author details are available only to the lecture's creator.

## Run locally

Install JDK 21 and Node.js 20.19+, 22.13+, or 24+, then run from the repository root on Windows:

```powershell
.\dev-local.ps1
```

Wait for `Started LocalApplication`, then open <http://localhost:5173>. The script starts a persistent local PostgreSQL database, Java, and Vite without Docker or VM access. See [local development](docs/Local_Development.md) for database connection settings, alternate ports, and tests. The VS Code **Dev: start both** task uses the same local database.

## Build and deploy

From `backend/`, run `./gradlew.bat test bootJar` on Windows (`./gradlew test bootJar` elsewhere). From `frontend/`, run `npm ci`, `npm run build`, `npm run lint`, and `npm run test:api`.

Use `./deploy-webapp.ps1` for the frontend and Java backend. The optional moderation service has its own `./deploy-moderation.ps1`; the web app always checks its bundled sensitive-word list, including when moderation is stopped. See the [deployment and recovery guide](deploy/README.md) before operating the VM.

Documentation: [API and permissions](docs/API.md), [database schema](docs/Database_State.md), and [moderation service](moderation/README.md).

Test?
