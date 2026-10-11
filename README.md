# AskPool

AskPool is a live classroom Q&A platform that gives every student a voice. Students join a lecture using a shared link, room code, or QR code, submit questions anonymously, and upvote the questions they want answered. Professors manage a live question queue, respond during class, and retain a history of their sessions.

The project pairs a responsive React interface with a Spring Boot API and PostgreSQL. It is designed to make in-class questions easier to collect, prioritise, and revisit—without interrupting the flow of a lecture.

## Highlights

- **Live lecture sessions** — create, share, pause, resume, and end lecture sessions.
- **Student-first participation** — join by link or QR code, ask anonymous questions, vote, and manage personal lecture history.
- **Professor workspace** — create courses, manage live queues, review session statistics, and access past lectures.
- **Clear question prioritisation** — rank questions by votes and submission time so the most relevant questions rise to the top.
- **Role-aware access** — each user can access both dashboards while ownership protects a professor's courses and lectures.
- **Content moderation** — a separate local/production moderation service screens abusive language before questions enter the pool.

## Technology

| Area | Stack |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Java 21, Spring Boot, Gradle |
| Database | PostgreSQL, Flyway |
| Testing | JUnit, Playwright, Node test runner |
| Deployment | Docker Compose, Caddy |

## Getting started

### Prerequisites

- Node.js 24 LTS recommended (Node 20.19+ or 22.13+ also supported)
- Java JDK 21
- Git and VS Code

Verify your installation with:

```sh
node --version
npm --version
java --version
javac --version
```

### Run locally

The quickest Windows setup needs no Docker or external database:

```powershell
.\dev-local.ps1
```

The launcher starts PostgreSQL, the API, and the Vite development server. When Java reports `Started LocalApplication`, open [http://localhost:5173](http://localhost:5173).

For macOS, Linux, or manual development, use two terminals:

```sh
# Terminal 1
cd backend
./gradlew localRun
```

```sh
# Terminal 2
cd frontend
npm ci
npm run dev
```

The local runner creates a persistent PostgreSQL instance at `127.0.0.1:55432`, serves the API on port `8080`, and uses a local demo identity. No `.env` file is needed for this default setup.

> On Windows, replace `./gradlew` with `./gradlew.bat`. In VS Code, **Tasks: Run Task → Dev: start both** starts the same local environment.

## How it works

1. A professor creates a course and starts a lecture session.
2. Students join the session from a shared link, numeric code, or QR code.
3. Students submit anonymous questions and upvote questions that matter to them.
4. The professor works through the prioritised queue, selecting or answering questions as the session progresses.
5. When the lecture ends, both sides can review their relevant history.

In local development, Vite provides the demo identity **Alex Morgan**. To test a second user, set `ASKPOOL_DEMO_USER_ID` and `ASKPOOL_DEMO_USER_NAME` in `frontend/.env.local`, then restart the frontend.

## Project structure

```text
.
├── frontend/     React application for student and professor experiences
├── backend/      Spring Boot REST API, Flyway migrations, and Java tests
├── moderation/   Standalone abusive-language moderation service
├── deploy/       VM deployment, reverse-proxy, and Docker Compose assets
├── docs/         Product, API, setup, and local-development documentation
└── dev-local.ps1 Windows local-development launcher
```

## Quality checks

Run the backend checks from `backend/`:

```sh
./gradlew test bootJar
```

Run the frontend checks from `frontend/`:

```sh
npm run build
npm run lint
npm run test:api
```

Backend tests use an isolated PostgreSQL process and do not change the persistent local development database.

## Documentation

- [Local development](docs/Local_Development.md) — operating the local stack, database access, and troubleshooting.
- [API contract](docs/API.md) — routes, permissions, and error behaviour.
- [Entry page and identity integration](docs/Entry_Page.md) — local and production identity handling.
- [Deployment guide](deploy/README.md) — production deployment and database adoption.
- [Moderation service](moderation/README.md) — moderation API and local setup.

## Deployment

Production uses a managed identity proxy that supplies `X-User-Id` and `X-User-Name` headers. The web app and moderation service are deployed independently; use `deploy-webapp.ps1` and `deploy-moderation.ps1` respectively. See the [deployment guide](deploy/README.md) for environment configuration and release instructions.

## License

This project is released under the [MIT License](LICENSE).
