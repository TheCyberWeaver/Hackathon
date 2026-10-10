# Java + PostgreSQL deployment

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

The ignored legacy `deploy-local.ps1` is incompatible with this contract: its Node packaging, `/api/questions` smoke checks, candidate database assumptions, and secret configuration need updating before reuse. This change does not deploy or alter that credential-bearing script.

Retain PostgreSQL backups/volumes. V2 is additive and keeps the original answer constraint. A rollback to the former Node deployment shows its separate demo store while PostgreSQL data remains intact. Do not remove either data volume during rollout or rollback.
