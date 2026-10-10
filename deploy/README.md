# Java + PostgreSQL deployment

## Moderation service

The release now includes a private CPU moderation container. Java checks a
question for abusive language before saving it; general and off-topic questions
are accepted. Service failures
allow submissions. See [the moderation API and policy](../moderation/README.md).

The tracked [deploy-moderation.ps1](../deploy-moderation.ps1) follows the existing
local deployment workflow and deploys frontend, Java, and moderation together:

```powershell
# Build, test and package locally, without connecting to the VM.
.\deploy-moderation.ps1 -BuildOnly -SkipInstall
# Check VM prerequisites, without deploying.
.\deploy-moderation.ps1 -CheckConnection
# Validate a candidate with its own disposable database.
.\deploy-moderation.ps1 -ValidateOnly -SkipInstall
# Deploy the integrated release.
.\deploy-moderation.ps1 -SkipInstall
```

Authentication defaults to your OpenSSH keys/agent and the `viscon-2026` alias.
If this VM uses password authentication, set `ASKPOOL_VM_PASSWORD` in your local
terminal or supply `-VmPassword`; it uses the same Paramiko transport as the
ignored local helper. Host keys must already be verified in `known_hosts`.
The tracked script contains no credentials and does not package credentials.
`-SshHost`, `-JdkPath`, `-DatabaseUrl`, `-AppPasswordFile`, and
`-BaselineDatabase` work like the existing helper. `-SkipInstall` reuses existing
frontend and moderation dependencies; a missing Python environment is created.
Python 3.12+ is needed locally for moderation tests, alongside JDK 21, Node,
OpenSSH, and tar. The server needs Docker Compose with image build support.

The bundle contains moderation source and its Dockerfile. On the server the
script builds a release-tagged image, baking in the quantized model from Hugging
Face. The image explicitly grants its app user read access to source and model
files, then checks API import and model inference as that user during the build.
The running service uses only cached model files. A healthy candidate must
pass real-model HTTP smoke checks and a Java submission check (accepted saved,
rejected not saved) before production is changed. Production is
checked again after switching; failure restores the previous application release
and its moderation image tag. Database backup/adoption behavior is retained.

Use `-ModerationThreshold 0.98` to make the filter more permissive, or adjust
`MODERATION_THRESHOLD` in a release's `.env` and recreate its moderation service.
The default `0.95` rejects only high-confidence toxicity predictions. Tune it
with real questions. The smoke check must still pass at the chosen setting. The model image
build requires package/model download access. No public moderation port is added.

## Application deployment

Caddy serves the frontend and proxies all `/api/*` to Java. Java joins the external `askpool_shared` network. The managed address https://08.hackathon.ethz.ch provides TLS/login. Java and PostgreSQL must have no public ports. The Node demo API is no longer deployed; its old data volume is neither migrated nor removed.

## Adopt the supplied VM schema

Back up the database. V1 matches the supplied schema; V2 adds lecture ownership, selection, soft deletion, votes, and reports. Do not run V1 again on the existing database.

Verify the three tables match V1 and are owned by `askpool_app`. Changing the database owner does not transfer existing table ownership. If initial SQL ran as postgres, run this from the database Compose directory:

```bash
docker compose exec -T postgres psql -U postgres -d askpool -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE public.users OWNER TO askpool_app;
ALTER TABLE public.lectures OWNER TO askpool_app;
ALTER TABLE public.questions OWNER TO askpool_app;
SQL
```

Build using backend `./gradlew test bootJar` (`gradlew.bat` on Windows), and frontend `npm run build` plus `npm run lint`. Place the executable Boot JAR at `artifacts/backend.jar` and frontend dist contents in `artifacts/frontend/` alongside the deployed Compose/Caddy files.

Confirm the database is reachable as `postgres:5432` on `askpool_shared`, or set the actual network alias in DATABASE_URL. Use an absolute path to the existing secret; Java reads `/run/secrets/app_password`. In the VM release directory:

```bash
export ASKPOOL_APP_PASSWORD_FILE=/absolute/path/to/database/secrets/app_password
export DATABASE_URL=jdbc:postgresql://postgres:5432/askpool
# First adoption of the VERIFIED existing V1 schema only:
export DATABASE_BASELINE=true
docker compose up -d
docker compose logs --tail 100 backend
```

Flyway baselines at V1 and applies V2 transactionally. Remove DATABASE_BASELINE after successful startup; the default is false. On an empty database leave it false, and both migrations run. Baseline does not validate that an untracked schema matches V1; verify first. See the [official Flyway baseline reference](https://documentation.red-gate.com/flyway/reference/commands/baseline).

## Professor permissions

The hackathon deployment currently defaults to `APP_TESTING_PERMISSIONS=true`:
all signed-in users can submit, vote, create lectures, view authors/reports in
the professor dashboard, and manage every lecture. This allows the same account
to test both dashboards without changing database roles. The one-question quota
and self-vote restriction still apply.

To restore role/owner checks on the VM, set `APP_TESTING_PERMISSIONS=false` in
the release `.env`, then run `docker compose -p hackathon up -d backend`.
The instructions below apply when testing permissions are disabled.

New identities default to students. Through an administrator database session, assign the exact identity supplied by the login proxy:

```sql
INSERT INTO users (eth_identity_ref, role)
VALUES ('actual-professor@ethz.ch', 'professor')
ON CONFLICT (eth_identity_ref) DO UPDATE SET role = EXCLUDED.role;
```

Professors create and own lectures. Legacy lectures have no owner; an admin can manage them, or assign their owner:

```sql
UPDATE lectures
SET owner_id = (SELECT id FROM users WHERE eth_identity_ref = 'actual-professor@ethz.ch')
WHERE id = 123;
```

## Verification and rollout

Java tests start an isolated PostgreSQL instance and test empty databases, V1 adoption, permissions, privacy, voting, quota races, and moderation without contacting the VM. Verify `/api/hello`, unauthenticated 401 for `/api/lectures`, managed login, professor creation, student joining/submission, voting/reports, and answer synchronization.

The ignored local `deploy-local.ps1` builds/lints the frontend, runs `test:api`,
tests/builds Java, and packages only Java and frontend assets. It prepares the
tracked `deploy/deploy-vm.sh` template, uploads with the existing SSH helper, and
checks `/api/me`, `/api/lectures`, and frontend assets. Credentials remain in the
ignored local helper and the existing VM secret; they are excluded from bundles.

```powershell
# Local checks and packaging only; no VM connection.
.\deploy-local.ps1 -BuildOnly

# Candidate validation only, using a disposable PostgreSQL database.
.\deploy-local.ps1 -ValidateOnly

# First adoption, AFTER verifying the supplied V1 schema and table ownership.
.\deploy-local.ps1 -ValidateOnly -BaselineDatabase
.\deploy-local.ps1 -BaselineDatabase

# Subsequent deployments after Flyway tracks the database.
.\deploy-local.ps1
```

The helper discovers `secrets/app_password` beneath the VM user's home only
when exactly one file matches. Otherwise provide
`-AppPasswordFile '/absolute/vm/path/secrets/app_password'`. Override the Docker
network address with `-DatabaseUrl 'jdbc:postgresql://actual-alias:5432/askpool'`.
These arguments refer to the VM, not Windows. `-SkipInstall` reuses frontend
dependencies; `-JdkPath` selects a Java 21 installation.

Before switching, read-only preflight checks verify connectivity, the three
initial tables' ownership, and whether explicit baseline adoption is needed.
Candidate validation applies migrations to its own empty PostgreSQL database;
it does not apply migrations to the existing VM database. A real deployment
creates a private `database-before.sql` backup in the release directory with a
PostgreSQL client matching the server's major version, then switches and checks
production. Baseline is disabled again after successful startup. Runtime
configuration is saved in the release `.env` for later Compose commands.

Retain PostgreSQL backups/volumes. V2 is additive and keeps the original answer constraint. A rollback to the former Node deployment shows its separate demo store while PostgreSQL data remains intact. Do not remove either data volume during rollout or rollback.

V3 handles the older VM schema where `lectures.professor_id` is required.
It backfills missing `owner_id` values and installs an insert trigger to populate
both ownership columns. Existing columns, constraints, lectures, and questions
are preserved. Fresh databases without `professor_id` need no compatibility
trigger. A DBA can apply the V3 SQL in a transaction to repair a running instance
before releasing Java; run it with `SET LOCAL ROLE askpool_app` so the
compatibility function belongs to the migration role. The subsequent Flyway
migration safely repeats it. V4 removes the one-question-per-student constraint
without deleting existing questions.

V5 adds shared lecture start/end and intake state, course labels, and optional
written answers. Existing pools become started sessions; new lectures must be
started explicitly. The older VM `votes` foreign key is changed to cascade only
when a question is permanently purged. Ordinary deletion still retains votes
and reports for restoration. This frontend and backend must be released together.

The ignored `deploy-local.ps1` contains the VM SSH configuration;
`dev-local.ps1` runs locally and does not connect to the VM.
