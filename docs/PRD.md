# PRD — Product Requirements Document

## 1. Users & Personas
- **Builder:** creates Zaps via UI, tests with manual trigger, checks run history.
- **External system:** Stripe/GitHub/form posts JSON to webhook URL.
- **Reviewer (recruiter):** opens dashboard, creates Zap in <2 min, fires webhook via curl.

## 2. Core Concepts (single release, no v2)
- User has many Zaps. Zap = 1 Trigger + N Actions in `sortingOrder`, executed sequentially. User can create and modify Zaps.
- Trigger types: `webhook`, `schedule` (cron), `github-poll`/`rss-poll`, `manual`.
- Action types: `email`, `slack`, `discord`, `http-request`, `delay`, `filter`.
- Templating: action config may contain `{metadata.*}` / `{{step1.output.email}}`, resolved at run time against trigger output + prior step outputs.
- App connections: Gmail/GitHub app actions use per-user `ConnectedAccount` (OAuth app tokens, encrypted + auto-refresh), separate from login `Account`.

## 3. Functional Requirements
| ID | Feature | Acceptance |
|----|---------|------------|
| F-1 | Signup/Login/Forgot (email-password + Google OAuth + GitHub auth, cookie session) | Email signup → login → `GET /api/v1/user/` returns name/email (bcrypt hash); Google/GitHub OAuth callback creates/links user via cookies; `POST /forgot` always-200 + `POST /reset` single-use 15min token, no enumeration |
| F-2 | List triggers/actions | `GET /api/v1/trigger/available`, `GET /api/v1/action/available` seeded on migrate |
| F-3 | Create Zap | `POST /api/v1/zap {availableTriggerId, triggerMetadata, actions[]}` atomic; returns `zapId` + webhook URL + secret (shown once); Zap create rate-limited 20/day/user |
| F-3b | Modify Zap | `PUT/PATCH /api/v1/zap/:id` with `If-Match: revision` (optimistic lock, 409 on stale); bumps `Zap.revision`; in-flight runs stay pinned to old revision |
| F-4 | View Zap | `GET /api/v1/zap/:id` owner-scoped (`where:{id,userId}` → 404 across users, no IDOR leak) |
| F-5 | Fire webhook | `POST /hooks/catch/:zapId` max 1MB body, HMAC over `timestamp.body` with `X-Zap-Timestamp` ±5min + idempotency key (30d TTL) + per-IP 60/min and per-Zap 300/min → 200 in <300ms, creates ZapRun |
| F-6 | Schedule trigger | Cron (UTC) stored in `Trigger.metadata`; scheduler every 30s creates ZapRun when due; durable `lastCursor` for polls |
| F-7 | Run history + dashboard analytics | `GET /api/v1/zap/:id/runs?cursor&limit≤100` + `GET /api/v1/dashboard` (active Zaps, run counts by status, latency) paginated |
| F-8 | Test Zap | `POST /api/v1/zap/:id/test` fires synthetic ZapRun with sample payload (rate-limited, never schedules) |
| F-9 | Action chaining | Worker runs actions in order pinned to Zap revision; `filter` can skip rest; `delay` suspends run and scheduler resumes (no worker sleep); failure stops chain and marks run failed; every action guarded by `ActionExecution(zapRunId,actionId)` dedupe → redelivery never double-executes |
| F-10 | App connections | `GET/POST /api/v1/connections/:app` (gmail|github) OAuth-app authorize → callback → encrypted `ConnectedAccount` + auto-refresh; `DELETE` disconnects; actions take `connectionId` |
| F-11 | Replay run | `POST /api/v1/runs/:id/replay` (owner-scoped, rate-limited) clones `metadata+zapRevision` into new `ZapRun`; DLT/FAILED replayable from history |
| F-12 | Step I/O detail | `GET /api/v1/runs/:id` returns `ZapRun + ZapRunStep[]{actionId, order, status, input, output≤100KB, error, latency}`; history detail expands per-step |
| F-13 | Builder test + mapping | `POST /api/v1/zap/test-trigger {availableTriggerId, triggerMetadata, connectionId?}` returns 3 sample items; builder maps fields via `{{step.output.*}}` dropdowns, Zod-validates resolved config |
| F-14 | Lifecycle | `PATCH /api/v1/zap/:id/active {active}` toggle; folders (`Folder` + `Zap.folderId`) + `?search&folder&active&status` on list/runs; runs retained 90d via cron; `GET /api/v1/user/export` + `DELETE /api/v1/user` (GDPR cascade) |

## 4. Non-Functional Requirements
- Webhook p99 <300ms (hooks never executes actions inline).
- Outbox → Kafka lag <5s at 100 req/s single partition; worker lag alert >5min.
- Idempotent: same `Idempotency-Key` twice = 1 ZapRun (30d TTL, then key may reuse). Same `zapRunId` consumed twice = 1 side-effect per action via `ActionExecution` dedupe for ALL actions.
- Availability: stateless services 2+ replicas; RPO via managed DB backups.

## 5. UX Scope
Landing (about the project only, no pricing anywhere), login/signup/forgot/reset (email-password + Google + GitHub), connect-apps in settings/builder, dashboard (folders + search + active toggle + activity/analytics), create + modify Zaps (test-trigger samples + field mapping), `[id]` detail, `history` (runs table + step drawer + Replay), `settings` (profile + connections + secret rotate + export/delete). Fix legacy hardcoded `userId=1` and date. No billing/pricing logic anywhere.

## 6. Out of Scope
Team sharing, versioning, branching logic UI, usage billing. No v2 — everything above is the single release.
