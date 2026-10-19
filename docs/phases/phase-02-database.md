# Phase 02 — Database (schema + connection + testing)

Goal: single source of truth DB + contracts + infra clients, per TRD section 1/3.

## Scope
- `packages/db/prisma/schema.prisma`: User, login Account, app ConnectedAccount(gmail|github, encrypted+refresh), Folder, Zap(revision/active/folderId), Trigger (ZapId unique, nextRunAt index, lastCursor), Action (sortingOrder, connectionId?), AvailableTriggers/Actions, ZapRun(status PENDING|RUNNING|SUCCESS|FAILED|SKIPPED|SUSPENDED, zapRevision, resumeAt), ZapRunStep(zapRunId+order, input/output 100KB), ZapRunOutbox (zapRunId unique, attempts max 10), ActionExecution(zapRunId+actionId unique), WebhookSecret(+rotatedAt), IdempotencyKey(30d TTL), PasswordReset(15min) + retention cron (runs+steps 90d).
- `packages/db/prisma/migrations/` + `packages/db/src/client.ts` (singleton PrismaClient + PgBouncer pooling) + `packages/db/prisma/seed.ts` (upsert 5 triggers: webhook/schedule/github-poll/rss-poll/manual + 6 actions: email/slack/discord/http-request/delay/filter).
- `packages/schemas/src/`: Zod `zap.ts ({{refs}} vs fields[]), user.ts, trigger.ts, action.ts, connections.ts, runs.ts` (1MB caps, pagination).
- `packages/kafka/src/`: `client.ts` (idempotent producer acks:all retries:5, consumer factory with manual offset commit — kafkajs `ConsumerConfig` has no `autoCommit` field; the `eachBatch` handler sets `payload.autoCommit = false` and calls `commitOffsetsIfNecessary()` only after the chain succeeds, giving at-least-once delivery), `payload.ts` (`{zapRunId,zapId,zapRevision,attempt}`, ID-only, never business data), `topics.ts` (`zap-events` 12 partitions key=zapId, `zap-events.retry`, `zap-events.DLT`).
- `packages/logger`: pino JSON + `x-request-id` + trace id + secret redaction. `traceIdFor(id)` = SHA-256 of the correlation id truncated to 32 lowercase hex chars (valid OpenTelemetry trace id, deterministic so one `zapRunId` keeps one trace id end-to-end, never all-zero); `resolveRequestId(headers)` reads `x-request-id` or generates a UUID; `requestLogger()` binds `requestId` + derived `traceId`, `runLogger(zapRunId)` binds `zapRunId` + `traceId=traceIdFor(zapRunId)` per TRD §60/§67 and DATAFLOW §5. `LOGGER_OPTIONS.redact` censors `password`, `passwordHash`, `token`, `accessToken`, `accessTokenEnc`, `refreshToken`, `accessEnc`, `refreshEnc`, `secret`, `signature` (both top-level and `*.` nested), plus `req.headers.authorization`, `req.headers.cookie`, `res.headers['set-cookie']` — tokens and secrets must never reach Loki.

## Env
`DATABASE_URL` (local postgres:16 pooled, prod Neon + PgBouncer). `KAFKA_BROKERS` (dev Redpanda, prod Upstash).

## Tests
vitest: schema migrates clean, seed idempotent, Zod rejects bad/oversize ZapCreate + bad {{ref}}, kafka payload `{zapRunId,zapId,zapRevision,attempt}` round-trips, ActionExecution dedupe blocks double-send, ZapRunStep written per action, IdempotencyKey TTL + runs-90d cleanup.

## Exit gate
`bun run db:migrate && bun run db:seed && turbo test` green. No app logic yet.
