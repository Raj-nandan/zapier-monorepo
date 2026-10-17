# Phase 02 — Database (schema + connection + testing)

Goal: single source of truth DB + contracts + infra clients, per TRD section 1/3.

## Scope
- `packages/db/prisma/schema.prisma`: User, login Account, app ConnectedAccount(gmail|github, encrypted+refresh), Folder, Zap(revision/active/folderId), Trigger (ZapId unique, nextRunAt index, lastCursor), Action (sortingOrder, connectionId?), AvailableTriggers/Actions, ZapRun(status PENDING|RUNNING|SUCCESS|FAILED|SKIPPED|SUSPENDED, zapRevision, resumeAt), ZapRunStep(zapRunId+order, input/output 100KB), ZapRunOutbox (zapRunId unique, attempts max 10), ActionExecution(zapRunId+actionId unique), WebhookSecret(+rotatedAt), IdempotencyKey(30d TTL), PasswordReset(15min) + retention cron (runs+steps 90d).
- `packages/db/prisma/migrations/` + `packages/db/src/client.ts` (singleton PrismaClient + PgBouncer pooling) + `packages/db/seed.ts` (upsert 5 triggers: webhook/schedule/github-poll/rss-poll/manual + 6 actions: email/slack/discord/http-request/delay/filter).
- `packages/schemas/src/`: Zod `zap.ts ({{refs}} vs fields[]), user.ts, trigger.ts, action.ts, connections.ts, runs.ts` (1MB caps, pagination).
- `packages/kafka/src/`: `client.ts` (idempotent producer acks:all retries:5, consumer factory autoCommit:false), `topics.ts` (`zap-events` 12 partitions key=zapId, `zap-events.retry`, `zap-events.DLT`).
- `packages/logger`: pino JSON + `x-request-id` + trace id.

## Env
`DATABASE_URL` (local postgres:16 pooled, prod Neon + PgBouncer). `KAFKA_BROKERS` (dev Redpanda, prod Upstash).

## Tests
vitest: schema migrates clean, seed idempotent, Zod rejects bad/oversize ZapCreate + bad {{ref}}, kafka payload `{zapRunId,zapId,zapRevision,attempt}` round-trips, ActionExecution dedupe blocks double-send, ZapRunStep written per action, IdempotencyKey TTL + runs-90d cleanup.

## Exit gate
`bun run db:migrate && bun run db:seed && turbo test` green. No app logic yet.
