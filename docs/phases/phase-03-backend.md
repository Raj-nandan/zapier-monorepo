# Phase 03 — Backend (auth + API + hooks + triggers/actions + pipeline)

Goal: full async pipeline per `../DATAFLOW.md` §2-5. Largest phase.

## Scope
- `apps/api/src/`: `index.ts`, `routes/user.ts` (email signup/signin/forgot/reset + `GET /user/` + `GET /user/export` + `DELETE /user` GDPR cascade), `routes/auth.ts` (login Google/GitHub), `routes/connections.ts` (`GET/POST/DELETE /connections/:app` gmail|github app OAuth, encrypted + refresh, owner-scoped), `routes/zap.ts` (atomic create with `folderId/connectionId` + `test-trigger` samples + `{{ref}}` validation + `PUT/PATCH /:id` revision lock + `PATCH /:id/active` toggle, all `where:{id,userId}`), `routes/trigger.ts, action.ts` (available + `fields[]`), `routes/dashboard.ts` + `routes/runs.ts` (`GET /zap/:id/runs?search&status`, `GET /runs/:id` with steps, `POST /runs/:id/replay` clone, `POST /zap/:id/test`), `middleware/auth.ts` (cookie-or-Bearer + IDOR incl. connections/runs), `rateLimit.ts`, `requestId.ts`, Helmet, `GET /healthz, /readyz`.
- `apps/hooks/src/`: `index.ts` (`POST /hooks/catch/:zapId` 1MB cap only), `verify.ts` (timestamp ±5min + constant-time HMAC + per-IP 60/min + per-Zap 300/min + `X-Idempotency-Key` 30d TTL) → `tx(ZapRun PENDING + Outbox)`, returns `{zapRunId}` p99 <300ms. Never runs actions inline. `GET /healthz` + `GET /readyz` (DB+Kafka) per TRD §51 (port 3002).
- `packages/triggers/src/`: `types.ts` (TriggerHandler `{slug, schema, fields[], fetchSample}` + registry `Map<slug, TriggerHandler>` + `getHandler(slug)` throws on unknown slug; `fields[]` is `FieldSpec` per TRD §9) + `schedule/, github-poll/, rss-poll/, manual/, webhook/` — all five seeded slugs resolve (app triggers take `connectionId`, decrypted server-side; schema + handler + test each). `webhook` is passive: `fetchSample()` returns `[]` (the external system supplies the payload), so `POST /zap/test-trigger` on `webhook` returns an empty sample set rather than erroring.
- `packages/actions/src/`: `types.ts` (ActionHandler `{slug, schema, fields[], run}` + registry `Map<slug, ActionHandler>` + `getHandler(slug)` throws on unknown slug; `fields[]` is `FieldSpec` per TRD §9) + `email/, slack/, discord/, http-request/ (SSRF allowlist, 10s timeout, 1MB cap), delay/ (suspend+resume, no sleep), filter/` (app actions take `connectionId`; each checks `ActionExecution` first).
- `apps/processor/src/`: `index.ts` (poll every 1s `... FOR UPDATE SKIP LOCKED LIMIT 100`, publish `{zapRunId,zapId,zapRevision}` key=`zapId`, delete on ack, `min(2^attempts,300)s` backoff, attempts>10 → DLT row). 2 replicas safe; duplicates absorbed by dedupe. `GET /healthz` + `GET /readyz` (DB+Kafka) per TRD §51 (port 3003).
- `apps/worker/src/`: `index.ts` (group `main-worker`), `runner.ts` (revision-pinned fetch, decrypt/refresh connection, `ActionExecution` guard, serial run, filter-break, delay→`SUSPENDED`+resume, 10-30s timeout, write `ZapRunStep` per action, retry×5 → DLT + `FAILED`), `parser.ts` (bounded `{{}}`, depth 5, 100 subs, 10KB) + `lib/ssrf.ts`. No worker sleep. `GET /healthz` + `GET /readyz` (DB+Kafka) per TRD §51 (port 3004).
- `apps/scheduler/src/`: `index.ts` + `jobs/cron.ts, polling.ts` (every 30s UTC, skip inactive Zaps, durable cursor, `tx(ZapRun+Outbox+nextRunAt/cursor)` + delay resume + connection refresh). 1 replica + liveness + missed-tick alert. `GET /healthz` + `GET /readyz` (DB+Kafka) per TRD §51 (port 3005).

## Env
`JWT_PASSWORD, TOKEN_ENC_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GMAIL_APP_ID, GMAIL_APP_SECRET, GITHUB_APP_ID, GITHUB_APP_SECRET, OAUTH_REDIRECT_URL, WEB_URL, SMTP_*, SLACK_*, DISCORD_*, REDIS_URL, KAFKA_BROKERS, TOPIC`.

## Auth tests
Email: bcrypt hash, generic 401 (no enumeration), lockout after 5 fails, access 15min expiry, refresh rotation, logout revokes `jti`, changed password bumps `v`. Forgot: always-200, 3/hr limit, single-use 15min token, reused/expired fails closed, reset revokes sessions. OAuth: invalid/expired-state 401, PKCE mismatch 401, first login creates `User+Account`, relogin reuses user, Google+GitHub same verified email links 2 Accounts → 1 User, no token in URL/logs, cookies `httpOnly+Secure+SameSite`. AuthZ: user B `GET/PUT` user A zap → 403.

## Tests
HMAC verify (size/timestamp/replay), parser bounds + bad-{{ref}} rejected, SSRF block, connections tokens never leak + refresh, test-trigger samples (no run), replay clones with new key, steps written, revision-pin, IDOR 403 (incl. connections/runs), toggle skips scheduler, folders/search scoped, export/delete cascades, k6 100rps lag<5s, kill-worker redelivery deduped.

## Exit gate
`docker-compose up` → signup → create Zap → curl webhook → email/slack arrives; run history shows SUCCESS/FAILED with latency.
