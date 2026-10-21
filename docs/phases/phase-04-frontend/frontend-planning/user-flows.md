# Zapier-Monorepo Frontend — User Flows

> **Document:** `docs/phase-04-frontend-planning/user-flows.md`
> **Status:** DRAFT v3 — aligned to `design-system.md` v3 (Canva design file), security-hardened
> **Purpose:** Step-by-step flows bound to backend contracts (`PRD.md` F-1–F-14, `DATAFLOW.md`). Frontend never decides auth, Zap config, or run status — it renders backend verdicts. v2 added route protection, secure redirects, CSRF/idempotency, secret handling, session expiry, and step-up flows. v3 aligns the flows to the drawn design: vertical builder canvas, inline run-detail panel, and the mobile behaviours from the `07 Mobile + states` canvas. Security IDs refer to `requirements.md` §5; scope decisions to §8.

## Authority Table

| Frontend owns | Backend owns |
|---|---|
| Navigation, form animation, optimistic toggle visuals (rolled back on error) | Session (cookies), signup/signin/forgot/reset verdicts, session expiry, token rotation |
| Redirect target validation (`safeNext()`) as a UX/safety layer | Final redirect validation for OAuth `next`, authorization on every request |
| Builder canvas layout, sample display, mapping dropdowns | `availableTriggers/Actions`, `fields[]`, `test-trigger` samples, `{{ref}}` validation |
| Table filters/pagination UI, run-detail panel open/close | Runs, steps, counts, `If-Match` revision conflicts (409) |
| Copy wording from `content.md`, loading/empty/error shells | `ZapRun/Step` status, Replay outcome, rate-limit verdicts |
| Attaching CSRF header and `Idempotency-Key`; escaping all rendered text | Issuing/verifying CSRF, idempotency, rate limits, re-auth (`REAUTH_REQUIRED`) |

## Backend Contract Assumptions (verify against `TRD.md` before build)

1. Session = `httpOnly; Secure; SameSite` cookies; access token short-lived with server-side rotation; logout denylists `jti`.
2. A CSRF token is issued by `GET /api/v1/csrf` (signed, 1h TTL, returned as `{ csrfToken }` and set as the readable `csrf_token` cookie) and required via `X-CSRF-Token` on every mutation (POST/PUT/PATCH/DELETE). Verification is double-submit (cookie must equal header and verify as a signed token). Anonymous requests without the cookie are allowed through; all authenticated state-changing requests are enforced. Keep the wiring behind a single `apiFetch()`.
3. API reachable same-origin via `/api/v1/*` proxy.
4. Sensitive endpoints may answer `401` with code `REAUTH_REQUIRED` (step-up) — the UI shows the re-auth dialog rather than redirecting.
5. OAuth start accepts only a relative `next`; backend uses `state` + PKCE and returns to `/auth/callback` on failure.

## Flow 0 — Route Protection & Redirects (applies to every navigation)

```text
Request → (edge middleware: cookie present? UX shortcut only)
        → (app layout, server): GET /api/v1/user/
            200 + valid user → render page
            401 | error | timeout | malformed → signed out (fail closed)
        → protected route & signed out → /login?next=safeNext(path)
        → auth route & signed in → /dashboard
```

1. **Middleware** may bounce requests with no session cookie straight to `/login?next=…` for speed. It never grants access and never skips step 2 (SEC-AUTH-3).
2. **Server guard** in the `(app)` layout calls `GET /user/` with the request cookies, `cache: 'no-store'`. Only a well-formed 200 response renders the page; every other outcome is signed out.
3. **`safeNext(path)`** keeps only allowlisted pathnames (see `pages.md` §Redirect Rules); query/hash dropped; otherwise `/dashboard`. Used for login, signup, OAuth, and client navigations from external input (SEC-RED-1..3).
4. **Auth pages while signed in** → `/dashboard` (SEC-RED-4). **`/reset`** is allowed with a token.
5. **Loop guard:** one redirect per navigation; if already on an auth route, render in place (SEC-RED-5).
6. **Headers/caching:** all of the above responses are `no-store`; the redirect response itself never contains tokens or user data.
7. **bfcache/back button:** on `pageshow` with `persisted`, revalidate; signed out → `/login` (SEC-CACHE-3).

Security checkpoints: SEC-AUTH-2/3, SEC-RED-1..5, SEC-CACHE-1/3.

## Flow 1 — Signup → Login

```text
/ → Create automation → /signup → submit → 200 → /dashboard (or safeNext)
```

1. User submits email + password (≥8, ≤128) + name; client validates with Zod first (UX only; server is authoritative).
2. `POST /api/v1/user/signup` with CSRF header → 200 sets session cookies → `safeNext(next)` or `/dashboard`. 409 shows generic copy with no account-exists hint (SEC-AUTH-5).
3. Submit disabled while pending; 429 shows retry countdown; password never logged or kept in query cache (SEC-AUTH-6).
4. Existing user: `/login` → `POST /signin` → generic `Invalid credentials. Please try again.` on failure; `Forgot password?` → Flow 1c.
5. Success clears any auth-page form state, then navigates; the response body is not rendered.

### Flow 1b — OAuth (Google / GitHub)

```text
Button → GET /api/v1/auth/:provider?next=<relative> → provider → backend callback → cookies → /dashboard
                                                                  └─ failure → /auth/callback?error=…
```

1. Frontend passes only a validated relative `next`; backend generates `state` + PKCE and verifies on return (frontend never handles OAuth codes or tokens).
2. Success: backend sets cookies and redirects to a validated path. Frontend shows nothing sensitive.
3. Failure: `/auth/callback` maps `error` through the fixed allowlist to fixed copy (`Google sign-in failed. Please try again.` / GitHub variant), strips the query string, and offers `Back to log in`. Unknown values → generic message (SEC-XSS-5).

### Flow 1c — Forgot → Reset

```text
/login → Forgot password? → /forgot → POST /forgot → generic success
email link → /reset?token=… → read once + replaceState → POST /reset → /login
```

1. `/forgot` always shows `If an account exists for that email, a reset link is on its way.` — same UI and timing class for any email (SEC-AUTH-5).
2. `/reset` reads `token` into memory, immediately removes it from the URL (`history.replaceState`), and sends it only in the POST body (SEC-SECRET-3). Page has `Referrer-Policy: no-referrer` and no third-party resources.
3. New password ≥8, same field rules as signup. Success → `Password updated. Please log in.` and redirect to `/login` (backend invalidates existing sessions).
4. Invalid/expired/used → `This reset link is invalid or expired. Request a new one.` + link to `/forgot`.

Security checkpoints: SEC-AUTH-5/6, SEC-SECRET-3, SEC-XSS-5, SEC-CSRF-1.

## Flow 2 — Create Zap (trigger → configure → Publish)

```text
/dashboard → Create automation → pick trigger → configure (+Test)
→ add actions → map fields → Publish → /zap/[id] (secret once)
```

1. Server guard passes (Flow 0). Builder loads `trigger/available` + `action/available`; unavailable entries disabled with reason. The library (260px) lists `Triggers` and `Actions` groups; the search field filters them.
2. The canvas is a **vertical** stack of node cards (300px wide, connected by vertical rules with a 22px `+` insert handle between steps). The `+` handle opens the library and inserts the chosen step **at that position**; the list order sent to the backend is `sortingOrder`. Dragging pans the canvas only — it never reorders steps.
3. Configure step → **Test trigger** (`POST /zap/test-trigger`, 10/min) shows 3 samples (rendered as text) in the inspector `Test` tab; no `ZapRun` is created. The inspector has three tabs: `Setup`, `Test`, `Settings`.
4. Each action maps fields via `{{step.output.*}}` dropdowns (tokens shown as text chips, never evaluated); app actions require a connected Gmail/GitHub account (prompt in builder if missing).
5. HTTP-request action URLs must be `http(s)` (client check; server SSRF protection is authoritative). Displayed as text.
6. Publish: `POST /api/v1/zap` with CSRF + fresh `Idempotency-Key` (Zod + `{{ref}}` check server-side). Button locks to `Publishing…`; `⌘↵` triggers the same submit.
7. Success shows webhook URL + **secret once** in an in-memory dialog (masked, Reveal, Copy → `Copied` toast); closing the dialog, navigating, or hiding the tab clears it (SEC-SECRET-1/2). Then → `/zap/[id]`.
8. `/zap/[id]` is the **same builder in edit mode**, bound to `GET /zap/:id`. The `Draft` badge and `Saved · {time}` indicator reflect real publish state and save time. The inspector `Settings` tab carries the workflow summary — active toggle, webhook URL, secret (rotate) — and a link into History filtered to this Zap (`requirements.md` §8.3 A1–A2). Saves use `If-Match: revision`; 409 → `This automation changed elsewhere. Reload to get the latest revision.`
9. 20/day limit shows the limit copy. Validation errors pin to the offending step. Network failure after submit → re-check via `GET /zap` before retrying with the same `Idempotency-Key`.
10. Unsaved builder state exists only in memory; leaving prompts `Leave without publishing?` and nothing is written to storage.

Security checkpoints: SEC-CSRF-1/3, SEC-XSS-1/6, SEC-SECRET-1/2, SEC-RED-6.

## Flow 3 — Webhook Fire → History

```text
External POST /hooks/catch/:zapId → 200 {zapRunId} → run appears in /history
```

1. External system posts JSON (≤1MB) with `X-Zap-Signature`, `X-Zap-Timestamp`, `X-Idempotency-Key`.
2. Hooks verifies (timestamp ±5min, HMAC, limits) → `tx(ZapRun PENDING + Outbox)` → 200 in <300ms. Failures (413/401/429) never create rows.
3. `/history` shows the run progressing `PENDING → RUNNING → SUCCESS|FAILED` (live region announces changes); expanding shows `ZapRunStep[]`. Duplicate deliveries reuse the original `zapRunId` (no new row).
4. All displayed payload fields are text; large values are truncated at 100 KB with the `Output (truncated at 100 KB)` label (SEC-XSS-2).

## Flow 4 — Schedule / Polling

Scheduler-owned; the UI only displays results. Cron (`Trigger.metadata`, UTC) and `github/rss-poll` cursors produce runs every ~30s tick. Inactive Zaps (`active=false`) are skipped — the toggle in dashboard/`[id]` explains this. Missed ticks surface via the scheduler alert, not invented client state. Toggle uses CSRF header; optimistic flip rolls back with a toast on rejection.

## Flow 5 — Test Zap

From `/zap/[id]`: `Test` → `POST /zap/:id/test` (CSRF, `Idempotency-Key`, rate-limited) fires a synthetic run with the sample payload → toast links to the new run in History. Test never schedules and never touches Kafka synchronously. 429 → rate-limit copy, no auto-retry.

## Flow 6 — Failure Inspect → Retry (Replay)

```text
/history → FAILED row → open run-detail panel → find failed step (input/output/error)
→ Retry run → new run → SUCCESS
```

1. Selecting a run opens the **480px inline run-detail panel** beside the table (not an overlay; on narrow screens it becomes a full-screen sheet). It shows each action's status, truncated input/output, error and latency in a step timeline; the failed step expands with the human sentence plus `Retry from this step` and `Check connection`.
2. Replay (`POST /runs/:id/replay`, CSRF, fresh `Idempotency-Key`, 10/day/run) clones `metadata + zapRevision`; the new `zapRunId` is linked and highlighted (selected row: `flame-50` background + `inset 2px 0 0 #F2540B`).
3. DLT/poison runs are replayable the same way; 429 shows the daily-replay copy; the button never auto-retries.
4. Error text is the backend `error` string rendered as plain text only (SEC-XSS-1).
5. `Copy ID` copies the run ID to the clipboard and shows the `Copied` toast.

## Flow 7 — Sign Out

```text
Account menu → Sign out → POST /api/v1/user/logout (CSRF) → clear caches → broadcast → /login
```

1. `POST /user/logout`: cookies cleared and `jti` denylisted by the backend.
2. Frontend clears React Query/SWR caches, in-memory secrets, optimistic state; posts `logout` on `BroadcastChannel` so other tabs redirect to `/login` (SEC-AUTH-7).
3. Lands on `/login` with `You have been signed out.` (no `next`).
4. Back-button visits revalidate via `GET /user/` and redirect on 401; no stale authenticated content (`no-store`, SEC-CACHE-1/3).
5. Logout failure (network): still clear client state and go to `/login`; the backend session expires by TTL; show `Something went wrong. Please try again.` only if the session check afterwards still succeeds.

## Flow 8 — Session Expiry / 401 Mid-Use

```text
Any API call → 401 → (dedupe) → clear caches + memory secrets → /login?next=safeNext(current)
```

1. A single `apiFetch` wrapper owns 401 handling; concurrent 401s coalesce into one redirect.
2. If the 401 code is `REAUTH_REQUIRED` (Flow 9), show the re-auth dialog instead of redirecting.
3. If already on an auth route, do nothing further (no loop).
4. After re-login, the user lands on the validated previous path (not the unsaved builder state; drafts are not persisted).
5. Copy: `Please log in to continue.`

## Flow 9 — Sensitive Actions (step-up) & Secret Rotation

Applies to: rotate webhook secret, disconnect an app, export my data, delete account.

```text
Action → confirm dialog → API call (CSRF) → 200 | 401 REAUTH_REQUIRED → re-auth dialog → retry once
```

1. Confirm dialog states the effect in plain words; destructive confirm uses the `destructive` button and is never default-focused (SEC-ABUSE-2).
2. **Rotate secret:** on 200 the new secret is shown once (Flow 2 step 6 rules); the old secret stops working immediately (copy says so).
3. **Delete account:** requires typing `DELETE`; on 200 → clear everything → `/` with `Your account has been deleted.`
4. **Export my data:** `GET /user/export` streamed to a Blob URL, downloaded, URL revoked; success toast `Export ready.`
5. **Re-auth dialog:** password (or provider re-auth for OAuth-only accounts); on success the original action is retried once automatically; failure leaves the dialog open with generic copy and the 429 rules.

## Flow 10 — Mobile / Responsive Behaviour

The `07 Mobile + states` canvas defines the small-screen product; these are not "degraded desktop", they are the designed mobile experience.

```text
≤lg  → sidebar becomes a sheet; ≥lg → fixed 248px sidebar (64px rail at md)
390px → 56px header + bottom tab bar (Dashboard, Create automation, History, Settings)
```

1. **Dashboard (390px):** 56px white header (logo + page title + 44px search button); stat cards in a 2-column grid; the automations table becomes **stacked cards** (name, meta, status badge) — no horizontal scrolling; the `Automations` section header keeps the `View history` link.
2. **Bottom tab bar (64px):** Dashboard, Create automation, History, Settings. It reflects the same frozen routes as the sidebar; it never introduces a route.
3. **History:** the table scrolls horizontally with the first column sticky; the run-detail panel becomes a full-screen sheet (design-system §9).
4. **Builder:** canvas is full-bleed; the step library and the inspector open as bottom sheets; the `+` insert handle and node cards keep their 300px measure (canvas pans vertically).
5. **Landing (390px):** hero H1 40px, body 15px, CTAs stacked full-width (accent first, then secondary).
6. **Motion:** every animation is disabled under `prefers-reduced-motion: reduce` — marquee static, beam hidden, skeleton shimmer off.
7. All touch targets are ≥44px; mobile buttons are 44px tall, icon buttons 44×44.

## Per-Flow Security Gate Summary

| Flow | Must pass |
|---|---|
| 0 | Unauth → `/login?next=…` on every protected route; auth → `/dashboard` on auth routes; fail closed; no loops |
| 1 / 1b / 1c | Generic errors; `safeNext()` vectors rejected; token removed from URL; no enumeration |
| 2 | Idempotent publish; secret never in storage/URL/cache; text-only rendering |
| 3 / 6 | XSS payloads inert in step I/O and error strings |
| 7 | All caches cleared; other tabs signed out; back button shows nothing |
| 8 | Single redirect; REAUTH handled; no leaks in URL |
| 9 | Confirm + (re-auth) + typed confirmation for delete; blob revoked |
| 10 | No new routes on mobile; bottom tab bar maps to frozen routes only; touch targets ≥44px; `prefers-reduced-motion` honoured |

---

**Status:** DRAFT v3
**Freeze rule:** Layout, component anatomy, screen copy and motion come from `design-system.md` v3 (the Canva design file); scope comes from `requirements.md` §8. Security rules here may be tightened but not relaxed without a PRD update. No new visual language without a PR to `design-system.md`.
