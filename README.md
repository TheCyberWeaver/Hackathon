# Hackathon

A working full stack starter: Vite React TypeScript and Tailwind CSS v4 in the browser, with a Java 21 Spring Boot Gradle REST API.

## Prerequisites

- Node.js 24 LTS recommended. Use Node 20.19+ or 22.13+ if staying on an older LTS line; the lint tooling needs the newer Node 22 patch.
- Java **JDK 21** and JAVA_HOME pointing to its installation folder.
- Git and VS Code. Open this repository root and install the recommended extensions.
- No global Gradle installation is required; the committed wrapper downloads it.

Verify with `node --version`, `npm --version`, `java --version` and `javac --version`.

## Run locally on Windows PowerShell

Open two terminals from the repository root.

Terminal 1:

```powershell
cd backend
$env:JAVA_HOME = Split-Path (Split-Path (Get-Command javac).Source)
.\gradlew.bat bootRun
```

Terminal 2:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open **http://localhost:5173** and click **Call Java API**. The response should be:

```json
{ "message": "Hello from Java 21" }
```

The direct API is http://localhost:8080/api/hello. Stop servers with Ctrl+C.

On macOS or Linux use `chmod +x backend/gradlew` once, then `./gradlew bootRun` from backend/. Use `npm` instead of `npm.cmd` for frontend commands. After installing dependencies, VS Code's **Tasks: Run Task > Dev: start both** launches both services in dedicated terminals. Use **Tasks: Terminate Task** to stop them. The **Debug backend** launch configuration supports Java breakpoints; stop bootRun first to free port 8080.

## Project structure

```text
Hackathon/
  .vscode/                  Extensions, tasks and Java debugging
  docs/                     API notes and setup guide
  frontend/
    src/App.tsx             Starter page and connection states
    src/components/         Reusable UI components
    src/lib/api.ts          Typed request and response validation
    src/index.css           Tailwind v4 import and theme
    public/                 Static assets
    vite.config.ts          React, Tailwind and API proxy
    .env.example            Public configuration template
    package-lock.json       Reproducible frontend dependencies
  backend/
    src/main/java/com/example/backend/
      BackendApplication.java
      HelloController.java
      config/WebConfig.java
    src/main/resources/application.properties
    src/test/java/com/example/backend/
    build.gradle
    gradle/wrapper/         Pinned Gradle distribution
    gradlew                 macOS and Linux wrapper
    gradlew.bat             Windows wrapper
```

Add frontend pages and backend services or repositories when the application needs them. This starter intentionally has no database or login dependency. Keep API keys and database credentials on the backend.

## Routing and environment variables

Local requests use the relative path `/api/hello`. Vite forwards `/api` to Java on port 8080 without rewriting the path. This same origin browser flow needs no CORS permission. The preview server has the same local proxy. Both Vite ports are strict so a busy port is reported immediately.

Copy `frontend/.env.example` to `frontend/.env.local` only if you need an override:

| Variable | Where | Default | Purpose |
| --- | --- | --- | --- |
| VITE_API_BASE_URL | Frontend build | Empty | Separate API origin such as https://api.example.com |
| PORT | Backend runtime | 8080 | HTTP listening port |
| APP_FRONTEND_ORIGIN | Backend runtime | http://localhost:5173 | Exact allowed origin for direct browser calls |

Restart Vite after editing its environment. VITE_ variables are embedded in public browser assets: never put secrets there. A production API URL must be set **before** building the frontend. For separate frontend and backend origins, set APP_FRONTEND_ORIGIN on the backend to the exact HTTPS frontend origin, without a path or trailing slash. Cookie authentication is not configured; if added later, review CORS, credentials and CSRF together.

If you change PORT locally, update both proxy targets in vite.config.ts. For direct API calls from preview, allow http://localhost:4173 instead of 5173. The default preview proxy already avoids that requirement.

## Check and build

In frontend/:

```powershell
npm.cmd ci
npm.cmd run lint
npm.cmd run format:check
npm.cmd run build
npm.cmd run preview
```

TypeScript checking and Vite create `frontend/dist/`. Preview serves it at http://localhost:4173 for local checking; it is not a production host. Run `npm.cmd run format` to format the frontend. Use `npm install` for intentional dependency changes and commit package-lock.json.

In backend/:

```powershell
$env:JAVA_HOME = Split-Path (Split-Path (Get-Command javac).Source)
.\gradlew.bat clean build
java -jar build/libs/backend-0.0.1-SNAPSHOT.jar
```

The build runs the context test, JSON endpoint test, allowed origin preflight test and rejected origin test. Stop bootRun before launching the JAR. On macOS or Linux replace `.\gradlew.bat` with `./gradlew`.

## Deploy when ready

**Separate services:** publish frontend/dist to a static host and deploy the executable Boot JAR to a Java 21 host. Configure frontend build root `frontend`, install `npm ci`, build `npm run build`, output `dist`. Configure backend build root `backend`, build `./gradlew clean build`, and start `java -jar build/libs/backend-0.0.1-SNAPSHOT.jar`. Set VITE_API_BASE_URL at frontend build time and APP_FRONTEND_ORIGIN at backend runtime. The backend accepts the host's PORT variable. Use HTTPS for both origins.

**One origin:** serve dist with a reverse proxy that forwards /api to Java, or copy dist's contents into backend/src/main/resources/static before building the JAR. Keep VITE_API_BASE_URL empty. The development proxy is not included in the production bundle. If client side routing is added, configure an index.html fallback for UI routes while preserving API errors and real asset paths.

## Troubleshooting

- **PowerShell blocks npm.ps1:** use npm.cmd as shown above.
- **Java or Gradle cannot start:** check JAVA_HOME and `.\gradlew.bat --version`; the project toolchain is Java 21. The Windows commands above select the JDK on PATH for the current terminal without changing global settings. If multiple JDKs are installed, ensure javac on PATH is version 21.
- **Port already in use:** stop the other process; frontend uses 5173, preview 4173 and backend 8080.
- **Connection error:** open the direct endpoint and check backend logs. Retry after Java has started.
- **CORS error:** check the exact frontend origin. The local relative request and proxy avoid CORS; direct requests need the configured backend origin.
- **No styles:** keep the Tailwind Vite plugin, `@import "tailwindcss";` in index.css, and the stylesheet import in main.tsx.

## Documentation

- [API contract](docs/API.md)
- [English setup guide with code blocks](docs/Setup_Guide.md)
- [Setup guide PDF with highlighted code](docs/Setup_Guide.pdf)

Keep the Gradle wrapper, frontend lockfile and example environment file in Git. The original MIT license applies; see [LICENSE](LICENSE).
