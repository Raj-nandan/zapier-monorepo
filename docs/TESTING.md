# TESTING — zapier-monorepo

Companion to `docs/TRD.md` §7 (test list), `docs/DATAFLOW.md` §7 (failure matrix), `docs/phases/phase-05-devops.md` (CI/CD pipelines), `docs/CLOUD-HOSTING.md` (free-tier targets).

## Testing Strategy

Pyramid: unit (vitest beside source) → integration (docker-compose Postgres + Redis + Redpanda) → E2E smoke (GH Actions job) → k6 load (nightly staging + PR label). Unit target <30s cold. p99 webhook <300ms. Kafka lag <5s at 100 rps. Every gate must be green before merge; latency/failure SLOs from `PRD.md` §4.

## Unit Tests

File convention: `*.test.ts` beside source. Cover: `packages/schemas` (Zod accepts/rejects, 1MB caps, `{{ref}}` validation), `packages/triggers` (cron nextRun, poll cursor advance, manual trigger sample), `packages/actions` (email/slack/discord template, http-request SSRF block, delay suspend/resume, filter skip/break), `apps/hooks` (HMAC timestamp ±5min, constant-time compare, idempotency dedupe, outbox TX), `apps/worker` (serial `sortingOrder` chain, `ActionExecution` dedupe prevents double send, SUSPENDED resume), `apps/processor` (`SKIP LOCKED` poller, `min(2^attempts,300)` backoff, attempts>10 → DLT), `apps/api` (auth, revision 409, pagination, folders/search scoping).

## Integration Tests

docker-compose service containers (postgres, redis, redpanda). Test DB truncated between runs. Cover: webhook → outbox → processor → Kafka → worker → email/slack side-effect (mock SMTP server). Chaos: kill worker mid-chain → verify redelivery + no duplicate side-effect via `ActionExecution`. Also: duplicate webhook (same `Idempotency-Key` → 1 row), oversized payload (413), stale timestamp (401), bad action config → FAILED + DLT copy.

## k6 Load Tests

3 scenarios: (a) webhook flood 500 VUs assert p99<300ms; (b) kafka lag drain check via Prometheus `kafka_lag` output; (c) full chain signup → create Zap → curl webhook → poll `/runs` until SUCCESS <10s. Tool: `grafana/k6-action`, HTML report as CI artifact. Profile to find DB/Kafka ceiling before Oracle/Neon free-tier limits.

## CI Pipeline (`ci.yml`)

On PR: `bun install` (cached) → `turbo lint/typecheck/build` → `turbo test` (with `services:`) → docker build all apps (no push). Free tier; must gate merge — red CI blocks merge. No push on PR per `CLOUD-HOSTING.md` §6.

## CD Pipeline (`cd.yml`)

On main: same CI gate → buildx push `ghcr.io` → `kubectl`/argocd sync → `rollout status --timeout=120s` → smoke curl `/healthz` + `/hooks/catch` → auto-rollback on failed smoke. Nightly k6 staging job for lag drift (`kafka_lag>5min` alert).

## Quality Gates & Metrics

| Gate | Threshold |
|---|---|
| Unit coverage | ≥80% |
| p99 webhook | <300ms |
| Kafka lag @100rps | <5s |
| Failure rate | <5% |
| Alert | lag>5min |

README line: "unit 80%, k6 p99 SLO, nightly lag alert, PR gate green before merge."
