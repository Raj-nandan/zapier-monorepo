# TRD — Technical Requirements Document

## 1. Monorepo & Toolchain
- `bun@1.x` workspaces + `turbo@2.x` pipelines (`build, dev, lint, test, db:migrate, db:seed`).
- TypeScript `strict`, ESM, `tsconfig.base.json` in `packages/config`.
- Single Prisma schema in `packages/db/prisma/schema.prisma` (fixes 3 drifted copies in legacy). All apps import `PrismaClient` from `@repo/db`.
- Contracts in `packages/schemas` (Zod): `ZapCreate, TriggerMetadata, ActionMetadata`. Frontend + API share them.
- Kafka helpers in `packages/kafka`: idempotent producer, consumer factory, topic constants, DLQ helper.
- Plugin registries: `packages/triggers`, `packages/actions` expose `TriggerHandler / ActionHandler { slug, schema, fields[] (dynamic input spec), fetchSample(), run() }`. App handlers receive decrypted `ConnectedAccount` token (never to client); `http-request` generic stays token-free.
- Logging: `packages/logger` (pino JSON + `x-request-id` + OpenTelemetry trace id).

## 2. Services (1 image = 1 Deployment)
| App | Responsibility | Scaling |
|-----|----------------|---------|
| `apps/web` | Next.js 14, `BACKEND_URL` + `HOOKS_URL` env | 2-3 replicas, HPA CPU |
| `apps/api` | Auth, Zap CRUD, runs/test endpoints. Never touches Kafka | 2-3 replicas, HPA RPS |
| `apps/hooks` | `POST /hooks/catch/:zapId` only. HMAC verify, rate-limit (Redis), `tx(ZapRun+Outbox)` | 3-5 replicas, HPA RPS |
| `apps/processor` | Outbox relay (producer). `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 100`, publish `{zapRunId}`, delete on ack | 2 replicas (safe via row locks) |
| `apps/worker` | Consumer group `main-worker`, fetch ZapRun+Zap, resolve `{metadata.*}`, run actions serially | KEDA on `kafka_lag` 2→10 |
| `apps/scheduler` | Cron/poll due triggers → `tx(ZapRun+Outbox)` | 1 replica |

## 3. Data Model (delta from legacy)
- Keep: `User, Zap, Trigger(ZapId @unique), Action(sortingOrder), AvailableTriggers/Actions, ZapRun, ZapRunOutbox(zapRunId @unique)`.
- Add: `Zap(revision Int @default(1), active, folderId?)` + `Folder(id, userId, name)` for lifecycle, `ZapRun(zapRevision, status: PENDING|RUNNING|SUCCESS|FAILED|SKIPPED|SUSPENDED, attempts, error, startedAt, finishedAt)` + `ZapRunStep(zapRunId, actionId, order, status, input, output≤100KB, error, latency @@index([zapRunId, order]))` for per-step debug, `ZapRunOutbox(attempts ≤10, nextRetryAt, createdAt @@index)`, `ActionExecution(zapRunId, actionId @@unique)` dedupe for ALL actions, `Trigger.nextRunAt @@index + lastCursor`, `WebhookSecret(zapId, secret, createdAt, rotatedAt)` + `POST /zap/:id/secret/rotate`, `IdempotencyKey(key @unique, zapId, zapRunId, expiresAt 30d @@index)` + nightly retention cleanup, login OAuth `Account(provider: google|github, ...)`, app `ConnectedAccount(id, userId, app: gmail|github, accountLabel, accessEnc, refreshEnc, expiresAt, scope)` (tokens encrypted via `TOKEN_ENC_KEY`, auto-refresh in scheduler/worker), `PasswordReset(...)` + cleanup, runs retained 90d via cron (`ZapRun + Steps` cascade delete).
- Migrations run as K8s `Job` with `advisory lock` (single runner on concurrent deploys), seeds upsert triggers/actions.

## 4. Kafka Design
- Topics: `zap-events` (12 partitions, key=`zapId` preserves per-Zap order; hot-Zap note: single Zap caps at 1 partition throughput, split load across Zaps), `zap-events.retry` (backoff consumer), `zap-events.DLT` (poison pills).
- Producer: `idempotent:true, acks:all, retries:5`, payload `{ zapRunId, zapId, attempt, zapRevision }` only (ID-only, never business data).
- Consumer: `autoCommit:false`, commit after successful chain; on action error → retry with backoff ×5 → DLT + mark `ZapRun FAILED`. Processor polls every 1s `LIMIT 100`, `nextRetryAt = now()+min(2^attempts,300)s`, attempts>10 → DLT row (no silent drop).
- Brokers via `KAFKA_BROKERS` env (fixes hardcoded `localhost:9092`). Dev: Redpanda. Prod: Upstash/Redpanda Cloud.

## 5. API & Webhook Contracts
- Email-password (`src/routes/user.ts` + `lib/password.ts` bcrypt cost 12, `lib/jwt.ts`):
  - `POST /api/v1/user/signup {username(email normalized lowercase/trim),password≥8,name}` Zod-validated → 409 if exists (generic message to avoid enumeration) → hash → `User.create`. Password never logged.
  - `POST /api/v1/user/signin` → timing-safe bcrypt compare → generic `401 invalid credentials` → on success issue access JWT (15min, `{userId, email, v: tokenVersion, jti}`) + rotating refresh token (7d, stored hash in DB/Redis) as `httpOnly Secure SameSite=Lax` cookies. No token in URL or body.
  - `POST /api/v1/user/logout` clears cookies + adds `jti` to Redis denylist until expiry. Password change bumps `tokenVersion`, revoking all sessions.
  - Forgot/reset (email users only, `src/routes/user.ts` + `lib/email.ts` via SMTP): `POST /api/v1/user/forgot {email}` → always 200 (no enumeration) + rate-limit 3/hr/email; if user exists with password, create single-use `PasswordReset(tokenHash, 15min)` and email link `WEB_URL/reset?token=` (raw token never stored). `POST /api/v1/user/reset {token, password≥8}` → timing-safe lookup, fail closed on expired/used → hash → `tx(password update + tokenVersion++ + PasswordReset.usedAt)` + revoke sessions. OAuth-only accounts get “use provider login” without revealing account type.
- OAuth (Google + GitHub, `src/routes/auth.ts` + `src/lib/oauth.ts` via `arctic`, state + PKCE + nonce in Redis 10min, exact `OAUTH_REDIRECT_URL` allowlist):
  1. Web `oauth-buttons.tsx` → `GET /api/v1/auth/google|github` → api stores `state+code_verifier+nonce`, 302 to provider.
  2. Callback: verify `state`, fail closed 401 on mismatch/expired; exchange `code+verifier` → tokens; fetch profile (email_verified required for Google).
  3. Upsert: `tx(User by verified email + Account{provider, providerAccountId})`; link if email exists, else create User (null password). Encrypt provider `accessToken` at rest.
  4. Issue same cookie session as email (no `?token=` in URL) → 302 to `WEB_URL/dashboard`. `auth/callback/page.tsx` only handles error display, never reads tokens.
- AuthZ: `middleware/auth.ts` reads cookie (web) or `Bearer` (API clients), verifies signature/expiry/`v`/denylist, loads User, enforces `zap.userId == auth.userId` on every Zap/run/connection query (IDOR guard).
- Connections (app OAuth, distinct from login): `GET /api/v1/connections/:app (gmail|github)` → state+PKCE in Redis → provider app OAuth → callback upserts `ConnectedAccount` (encrypted, `scope` stored) → `DELETE /api/v1/connections/:id` disconnects. Worker/scheduler decrypt server-side only, refresh when `expiresAt<5min`, never expose tokens. Secrets `GMAIL_APP_*, GITHUB_APP_*` via ExternalSecrets.
- Builder/test: `POST /api/v1/zap/test-trigger {availableTriggerId, triggerMetadata, connectionId?}` (owner-scoped, 10/min) calls `fetchSample()` → 3 items (no ZapRun). Zap create validates `{{step.output.*}}` refs against `fields[]` + prior steps.
- Runs/replay/steps: `POST /api/v1/runs/:id/replay` clones `metadata+zapRevision` (new idempotency key, 10/day/run) → `tx(ZapRun+Outbox)`. `GET /api/v1/runs/:id` returns run + `ZapRunStep[]` (owner-scoped). Worker writes one `ZapRunStep` per action (input/output truncated 100KB).
- Lifecycle: `PATCH /api/v1/zap/:id/active {active}` toggle (scheduler skips inactive); lists accept `?search&folderId&active&status&cursor&limit≤100`. `GET /api/v1/user/export` (JSON dump) + `DELETE /api/v1/user` (cascade User→Zaps→Runs→Steps→Connections, bumps denylist).
- `POST /api/v1/zap` requires auth cookie-or-Bearer, Zod-validated, `where:{userId}` scoping, create rate-limit 20/day/user, transactional. `PUT/PATCH /api/v1/zap/:id` requires `If-Match: revision` (409 stale), bumps `revision`, pins in-flight runs. `GET /api/v1/dashboard` + `/zap/:id/runs` paginated (`cursor, limit≤100`).
- `POST /hooks/catch/:zapId` max 1MB, headers `X-Zap-Signature: hmac(secret, timestamp.rawBody)`, `X-Zap-Timestamp` (±5min), `X-Idempotency-Key: uuid` (30d TTL). Verifies timestamp → HMAC (constant-time) → per-IP 60/min + per-Zap 300/min → idempotency → `tx(ZapRun PENDING + Outbox)`. Returns `{ zapRunId }` immediately. Secret via `GET /zap/:id` once + `POST /zap/:id/secret/rotate`.
- Health: `GET /healthz` (liveness), `GET /readyz` (DB+Kafka checks) on every service.

## 6. Security / Reliability / Observability
- Secrets via ExternalSecrets (never in image): `DATABASE_URL, DIRECT_URL (migrate), JWT_PASSWORD(32B random), TOKEN_ENC_KEY, SMTP_*, SLACK_*, DISCORD_*, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GMAIL_APP_ID, GMAIL_APP_SECRET, GITHUB_APP_ID, GITHUB_APP_SECRET, OAUTH_REDIRECT_URL, WEB_URL`.
- Auth hardening: brute-force rate-limit (5 fails/IP+email → 15min lock, audit `auth_fail` log without password), security headers (HSTS, CSP, X-Frame-Deny, nosniff) via Helmet, TLS-only cookies, CORS allowlist (`WEB_URL` only, `credentials:true`), Prisma params only, encrypted OAuth tokens, ownership checks on all Zap/run reads/writes.
- Hook hardening: 1MB body cap, timestamp window, per-Zap + per-IP limits, constant-time HMAC compare, secret rotation.
- Worker hardening: `http-request` SSRF allowlist (blocklist metadata `169.254.169.254`, cluster DNS; `http(s)` only, 10s timeout, 1MB response cap); parser limits (depth 5, 100 substitutions, 10KB output); `delay` never sleeps worker — marks `SUSPENDED` + `resumeAt`, scheduler resumes via outbox.
- Infra hardening: Redis `noeviction` for denylist/OAuth state (separate DB/index), PgBouncer/pooled Neon for connection caps, multi-arch (`linux/arm64,amd64`) images for Oracle ARM + laptop, HPA-RPS via custom metrics (else CPU fallback), retention cron for `IdempotencyKey/Outbox-DLT/ZapRun-90d`.
- Rate-limit hooks 60/min/IP (Redis), CORS allowlist, Prisma parameterized queries.
- Metrics (Prometheus): `http_duration, zap_runs_total{status}, kafka_produce_total, kafka_lag, action_duration{action}`. Logs JSON to Loki. Traces `traceId: zapRunId` end-to-end. Alerts: lag>5min, failure rate>5%.

## 8. LLD Specification
- Atomic transaction: Webhook and Zap creation use a single Postgres transaction so ZapRun + Outbox or Zap + Trigger + Actions either all commit or all roll back. Kafka is never written inside the request path, which removes dual-write loss.
- Outbox pattern: Instead of sending to Kafka directly, hooks writes intent to ZapRunOutbox table alongside business data. A separate relay publishes it later, so a Kafka outage just delays delivery instead of losing runs.
- Sweeper / relay: Processor polls every 1s the outbox with FOR UPDATE SKIP LOCKED LIMIT 100, publishes {zapRunId,zapId,zapRevision} with idempotent producer, deletes on ack or backs off `min(2^attempts,300)s`; attempts>10 → DLT row. Two replicas safe without double-picking; crash between publish→delete redelivers, absorbed by ActionExecution dedupe.
- Partitioning for scale: zap-events uses key zapId across 12 partitions, so one Zap stays ordered while different Zaps run in parallel. Workers share group main-worker; adding replicas triggers Kafka rebalance and linear throughput with no code change.
- Monitoring / logs: All services log JSON with traceId=zapRunId to Loki, expose Prometheus metrics for latency, run rate, and consumer lag, with alerts on lag and failure rate. One trace ID shows a run from webhook to worker.
- K8s: Stateless apps run as Deployments with health probes; api/hooks autoscale on CPU/RPS via HPA while worker autoscales on Kafka lag via KEDA. Secrets come from ExternalSecrets and migrations run as a Job, keeping images stateless.

## 7. Testing
- `vitest`: parser, each action handler (mock SMTP/HTTP), HMAC verify.
- Auth security tests: wrong-password generic 401, expired/tampered JWT rejected, revoked `jti`/`tokenVersion` rejected, OAuth invalid-state/expired 401, PKCE mismatch 401, IDOR (user B cannot `GET/PUT` user A zap → 403), rate-limit/lockout trips, cookies are `httpOnly+Secure+SameSite` and no token appears in URL/logs.
- App/zap tests: unverified-email OAuth never links, `ConnectedAccount` tokens never leak to client, refresh rotates, disconnect revokes; replay clones metadata+revision with new key; `ZapRunStep` written per action; toggle inactive skips scheduler; folders/search scoped; export/delete cascades.
- Contract test: processor payload matches worker parser.
- Load: k6 `hooks → lag` 100 rps; chaos: kill worker mid-run, verify redelivery no duplicate side-effect for idempotent actions.
