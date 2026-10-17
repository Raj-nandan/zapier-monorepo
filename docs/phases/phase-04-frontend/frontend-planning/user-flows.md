# Zapier-Monorepo Frontend — User Flows

> **Document:** `docs/phase-04-frontend-planning/user-flows.md`
> **Status:** DRAFT
> **Purpose:** Step-by-step flows bound to backend contracts (`PRD.md` F-1–F-14, `DATAFLOW.md`). Frontend never decides auth, Zap config, or run status — it renders backend verdicts.

## Authority Table

| Frontend owns | Backend owns |
|---|---|
| Navigation, form animation, optimistic toggle visuals (rolled back on error) | Session (cookies), signup/signin/forgot/reset verdicts |
| Builder canvas layout, sample display, mapping dropdowns | `availableTriggers/Actions`, `fields[]`, `test-trigger` samples, `{{ref}}` validation |
| Table filters/pagination UI, drawer open/close | Runs, steps, counts, `If-Match` revision conflicts (409) |
| Copy wording from `content.md`, loading/empty/error shells | `ZapRun/Step` status, Replay outcome, rate-limit verdicts |

## Flow 1 — Signup → Login

```text
/ → Create automation → /signup → submit → 200 → /dashboard
```

1. User submits email + password (≥8) + name; client validates with Zod first.
2. `POST /api/v1/user/signup` → 200 sets session cookies → `/dashboard`. 409 uses the generic “account exists” copy (no enumeration).
3. OAuth: Google/GitHub button → `GET /api/v1/auth/:provider` → provider → callback → cookies → `/dashboard`. Failures land on `/auth/callback` error copy.
4. Existing user: `/login` → `POST /signin` → generic “Invalid credentials” on failure; “Forgot password?” → `/forgot` (always-success copy) → email link → `/reset?token=` → `POST /reset` → login.

## Flow 2 — Create Zap (trigger → configure → Publish)

```text
/dashboard → Create automation → pick trigger → configure (+Test)
→ add actions → map fields → Publish → /zap/[id] (secret once)
```

1. Builder loads `trigger/available` + `action/available`; unavailable entries disabled with reason.
2. Configure step → Test trigger (`POST /zap/test-trigger`, 10/min) shows 3 samples; no `ZapRun` is created.
3. Each action maps fields via `{{step.output.*}}` dropdowns; app actions require a connected Gmail/GitHub account (prompt in builder if missing).
4. Publish: `POST /api/v1/zap` (Zod + `{{ref}}` check server-side) → success shows webhook URL + secret once → `/zap/[id]`. 20/day limit shows the limit copy. Validation errors pin to the offending step.

## Flow 3 — Webhook Fire → History

```text
External POST /hooks/catch/:zapId → 200 {zapRunId} → run appears in /history
```

1. External system posts JSON (≤1MB) with `X-Zap-Signature`, `X-Zap-Timestamp`, `X-Idempotency-Key`.
2. Hooks verifies (timestamp ±5min, HMAC, limits) → `tx(ZapRun PENDING + Outbox)` → 200 in <300ms. Failures (413/401/429) never create rows.
3. `/history` shows the run progressing `PENDING → RUNNING → SUCCESS|FAILED`; expanding shows `ZapRunStep[]`. Duplicate deliveries reuse the original `zapRunId` (no new row).

## Flow 4 — Schedule / Polling

Scheduler-owned; the UI only displays results. Cron (`Trigger.metadata`, UTC) and `github/rss-poll` cursors produce runs every ~30s tick. Inactive Zaps (`active=false`) are skipped — the toggle in dashboard/`[id]` explains this. Missed ticks surface via the scheduler alert, not invented client state.

## Flow 5 — Test Zap

From `/zap/[id]`: “Test” → `POST /zap/:id/test` (rate-limited) fires a synthetic run with the sample payload → toast links to the new run in History. Test never schedules and never touches Kafka synchronously.

## Flow 6 — Failure Inspect → Retry (Replay)

```text
/history → FAILED row → expand steps → find failed step (input/output/error)
→ Replay → new run → SUCCESS
```

1. Steps drawer shows each action’s status, truncated input/output, error, latency.
2. Replay (`POST /runs/:id/replay`, 10/day/run) clones `metadata + zapRevision` with a fresh idempotency key; the new `zapRunId` is linked and highlighted.
3. DLT/poison runs are replayable the same way; 429 shows the daily-replay copy.

## Flow 7 — Sign Out

Header/sidebar “Sign out” → `POST /api/v1/user/logout` → cookies cleared + `jti` denylisted → `/login`. Any cached dashboard data is discarded; back-button visits revalidate via `GET /user/` and redirect to login on 401.

---

**Status:** DRAFT
**Freeze rule:** Colors, type, and spacing come from `design-system.md` tokens only. No new visual language without a PRD update.
