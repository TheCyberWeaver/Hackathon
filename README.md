# Hackathon

AskPool is a classroom Q&A app built with Vite React TypeScript and Tailwind CSS v4, with a Java 21 Spring Boot Gradle REST API. The entry page identifies the signed-in user and provides student and professor entry points.

## Prerequisites

- Node.js 24 LTS recommended. Use Node 20.19+ or 22.13+ if staying on an older LTS line; the lint tooling needs the newer Node 22 patch.
- Java **JDK 21** and JAVA_HOME pointing to its installation folder.
- Git and VS Code. Open this repository root and install the recommended extensions.
- No global Gradle installation is required; the committed wrapper downloads it.

Verify with `node --version`, `npm --version`, `java --version` and `javac --version`.

## Run locally

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

On macOS/Linux, use `npm ci`. Also run this once from the repository root:

```bash
chmod +x backend/gradlew
```

No `.env` file is required for the default local setup.

### 4. Start development

Press **Ctrl+Shift+P**, select **Tasks: Run Task**, then choose:

```text
Dev: start both
```

This starts the frontend and backend in separate terminals. Wait for Java to finish starting; the first run downloads Gradle and dependencies.

Open **http://localhost:5173** to see the AskPool name and **Student** / **Professor** entry buttons. Local development uses a sample identity (Alex Morgan) through the Vite proxy. Choose either button to open its dashboard handoff page.

Production uses the managed proxy's `X-User-Id` and `X-User-Name` headers via `GET /api/me`. Dashboard integration and local identity settings are documented in [docs/Entry_Page.md](docs/Entry_Page.md).

### 5. Make changes

- Frontend: edit `frontend/src/` — browser updates automatically.
- Backend: edit `backend/src/main/java/` — restart **Backend: dev** after changes.
- Stop services: **Tasks: Terminate Task**.
- Debug Java: stop the backend task, then select **Debug backend** in Run and Debug and press **F5**.

Full commands and troubleshooting are in the repository’s **README.md**.
