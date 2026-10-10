# Hackathon

AskPool is a classroom Q&A app built with Vite React TypeScript and Tailwind CSS v4, with a Java 21 Spring Boot Gradle REST API. The entry page identifies the signed-in user and provides student and professor entry points.

## Prerequisites

- Node.js 24 LTS recommended. Use Node 20.19+ or 22.13+ if staying on an older LTS line; the lint tooling needs the newer Node 22 patch.
- Java **JDK 21** and JAVA_HOME pointing to its installation folder.
- Git and VS Code. Open this repository root and install the recommended extensions.
- No global Gradle installation is required; the committed wrapper downloads it.

Verify with `node --version`, `npm --version`, `java --version` and `javac --version`.

## Run locally

For the complete local app **without Docker or VM deployment**, run
`./dev-local.ps1` from the repository root on Windows. It starts persistent
PostgreSQL, Java, and Vite with testing permissions. Open
http://localhost:5173 once Java reports `Started LocalApplication`.
See [local development and database connection settings](docs/Local_Development.md).
The steps below also describe the optional Docker/manual setup.

After cloning, each teammate follows these steps in VS Code.

### 1. Install prerequisites

- **Node.js 24 LTS** — includes npm.
- **Java JDK 21** — ensure `java --version` and `javac --version` show 21.
- **Git** and **VS Code**.

Gradle is downloaded automatically by the included wrapper.

### 2. Open the repository

In a terminal:

```powershell
git clone https://github.com/TheCyberWeaver/Hackathon.git
cd Hackathon
code .
```

Because the repository is private, teammates need GitHub access.

Open the **Hackathon root folder**, containing both `frontend` and `backend`. Install the workspace’s recommended extensions when VS Code prompts.

### 3. Install frontend dependencies once

In VS Code → **Terminal → New Terminal**:

```powershell
cd frontend
npm.cmd ci
```

On macOS/Linux, use `npm ci`. The committed Gradle wrapper is executable.

No `.env` file is required for the default local setup.

### 4. Local PostgreSQL

The default **Backend: dev** task starts a persistent PostgreSQL database on
`127.0.0.1:55432` automatically. It enables testing permissions so the same
account can use both dashboards. No Docker, database password, or VM is required.
Database files are retained in `backend/.local-postgres/` between runs.

For an external database instead, use **Backend: external database**. This
optional Docker setup uses port 5432:


```powershell
$env:DATABASE_PASSWORD = 'choose-a-local-development-password'
docker compose -f backend/compose.local.yaml up -d
```

Set `DATABASE_PASSWORD` in the terminal running Java too. Defaults are
`DATABASE_URL=jdbc:postgresql://localhost:5432/askpool` and
`DATABASE_USER=askpool_app`. Spring does not load `.env` files automatically.
Flyway migrates an empty database on startup. For the existing VM database, see
[deployment and schema adoption](deploy/README.md), including table ownership
and the one-time baseline flag.

Local demo accounts default to students. Assign the demo identity professor
permissions through an administrator database session as documented in the
deployment guide; use another `ASKPOOL_DEMO_USER_ID` in `frontend/.env.local`
for student testing.

### 5. Start development

Press **Ctrl+Shift+P**, select **Tasks: Run Task**, then choose:

```text
Dev: start both
```

This starts the frontend, backend, and local database in separate terminals. Wait for `Started LocalApplication`; the first run downloads Gradle, dependencies, and PostgreSQL binaries.

Open **http://localhost:5173** to see the AskPool entry buttons. Vite supplies a sample identity (Alex Morgan) locally. Dashboard data requires Java on port 8080 and PostgreSQL. Professors create lectures and share student join links; both dashboards use the same persisted questions.

Production uses the managed proxy's `X-User-Id` and `X-User-Name` headers via `GET /api/me`. Dashboard integration and local identity settings are documented in [docs/Entry_Page.md](docs/Entry_Page.md).

### 6. Make changes

- Frontend: edit `frontend/src/` — browser updates automatically.
- Backend: edit `backend/src/main/java/` — restart **Backend: dev** after changes.
- Stop services: **Tasks: Terminate Task**.
- Debug Java with an external database: stop the backend task, start your configured PostgreSQL database, then select **Debug backend (external database)** in Run and Debug and press **F5**.

Full commands and troubleshooting are in the repository’s **README.md**.

Verify with backend `./gradlew.bat test bootJar` (Windows) or
`./gradlew test bootJar` (macOS/Linux), and frontend `npm run build` plus
`npm run lint` and `npm run test:api`. Java tests start an isolated PostgreSQL process automatically,
without Docker or VM credentials. The first run downloads platform binaries.
See the [API contract](docs/API.md) for routes, errors, and permissions.

Abusive-language moderation runs as a separate CPU service on the deployment
VM. See [moderation](moderation/README.md) for its minimal API and local setup.
Use [deploy-webapp.ps1](deploy-webapp.ps1) for the web app and
[deploy-moderation.ps1](deploy-moderation.ps1) for the moderation service.
For a temporary local testing page, run `./test-moderation.ps1` and open
http://127.0.0.1:8091. Its **Stop portal** button closes the test service;
`./test-moderation.ps1 -Stop` also stops it from PowerShell.
