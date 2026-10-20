# Zapier-Monorepo Frontend — V1 Requirements

> **Document:** `docs/phase-04-frontend-planning/requirements.md`
> **Status:** DRAFT v2 — aligned to `design-system.md` v2, security-hardened
> **Purpose:** Define exactly what the V1 frontend must provide, what is intentionally outside V1, and the security baseline every screen must meet. Product truth lives in `docs/BRD.md`, `docs/PRD.md`, `docs/TRD.md`, `docs/DATAFLOW.md`. This file must not contradict them.
> **v2 changes:** (1) design-system v2 reconciliation (§8), (2) new Security Requirements (§5) and threat model (§6), (3) hardened Must/Must-not, (4) security gates in Definition of Done (§10).

## 1. Frontend Goal

V1 demonstrates one coherent automation product:

```text
Signup/Login → Dashboard → Create automation (trigger → actions → Publish)
→ Fire webhook / schedule runs → History → Inspect failure → Retry
```

The frontend must feel like a shipped SaaS product (design-system v2: warm paper/ink, one flame accent, shadcn-style components), not a collection of developer pages. It reuses the working legacy flows (landing, auth split layout, dashboard table, zap-create builder), wires every mock to real backend data, and **fails closed**: when auth state is unknown or a check errors, the user is treated as signed out.

## 2. The Three Experiences

### Experience A — Builder (create + edit)

The user picks 1 trigger (`webhook`, `schedule`, `github-poll`, `rss-poll`, `manual`) and N ordered actions (`email`, `slack`, `discord`, `http-request`, `delay`, `filter`), configures each step, maps fields via `{{step.output.*}}` dropdowns against 3 `test-trigger` samples, connects Gmail/GitHub apps where required, and publishes.

```text
Pick trigger → Configure (+ Test trigger samples) → Add action(s)
→ Map fields → Review → Publish
```

Layout (design-system §5): step library left, dotted canvas center, 320px inspector right; top bar with editable name, saved indicator, Test, **Publish**. Edit (`/zap/[id]`) is the same builder bound to `GET /zap/:id`, saving with `If-Match: revision` (409 → reload prompt). In-flight runs stay pinned to the old revision — the UI must say so after Publish.

### Experience B — Workflow Detail (`/zap/[id]`)

One page answers: what does this automation do, is it on, and did it work lately. It shows trigger + ordered actions (read from backend, never static), active toggle (`PATCH /zap/:id/active`), webhook URL + secret (secret shown once, rotate button), recent runs for this Zap, and entry points to History detail and Replay.

### Experience C — History / Ops (`/history` + run detail)

The operations surface. Dense table of runs (`status`, Zap name, latency, error, time), filters (`search`, `status`, Zap), cursor pagination, and a 480px run-detail drawer with step timeline (`ZapRunStep[]`: input/output ≤100KB, latency) plus Replay (`POST /runs/:id/replay`) for FAILED/DLT runs. Runs are retained 90 days — the UI states this where history could look empty.

## 3. Must / Must-Not

**Must:**

- Wire every page to the contracts in `pages.md`; no static mock rows, dates, or user data.
- Send cookies on every API call (`credentials: include`); never store tokens in JavaScript (memory, `localStorage`, `sessionStorage`, IndexedDB, URL).
- Treat backend as authority for auth state, Zap config, `ZapRun`/`ZapRunStep` status, and analytics (§4).
- Show loading, empty, error states on every data screen (§7).
- Keep working legacy labels verbatim (`My automations`, `Create automation`, `Sign out` — see `content.md`).
- Support keyboard navigation and `prefers-reduced-motion` throughout.
- Validate every redirect target against the allowlist in `pages.md` §Redirect Rules before navigating (SEC-RED-*).
- Render every backend-provided string (errors, step input/output, Zap names, URLs) as **text**, never as HTML (SEC-XSS-*).
- Attach a CSRF token and `Idempotency-Key` where specified in `user-flows.md` (SEC-CSRF-*).

**Must-not:**

- Never invent routes outside the frozen table in `pages.md`.
- Never rename working labels or reorder the proven signup → dashboard → create flow.
- Never display stack traces, SQL/DB errors, raw webhook secrets (except once at creation or rotation), connection tokens, or reset tokens.
- Never mark auth/payment-like state client-side; never fake a run as SUCCESS before the backend says so.
- No pricing or billing logic or UI anywhere (v2 design elements that imply billing are dropped — §8).
- Never use `dangerouslySetInnerHTML`, `eval`, `new Function`, `document.write`, `innerHTML`, or inline event-handler strings.
- Never trust a URL parameter for authorization, redirection or rendering without validation.
- Never load third-party scripts on `/login`, `/signup`, `/forgot`, `/reset`, `/auth/callback`, `/settings`, or any authenticated route.

## 4. Backend-Is-Authority Rule

| Concern | Owner |
|---|---|
| Auth session (logged in / out), session expiry, token rotation | Backend (`GET /api/v1/user/`, `httpOnly` cookies) |
| CSRF token issuance and verification | Backend |
| Authorization (who may read/write which Zap/run) | Backend — UI gating is cosmetic only |
| Zap config, revision, active flag | Backend (`GET /zap/:id`, `If-Match`) |
| Run + step status, analytics counts | Backend (`/runs`, `/dashboard`) |
| Trigger samples for mapping | Backend (`POST /zap/test-trigger`) |
| Rate limits (create 20/day, replay 10/day/run, test-trigger 10/min) | Backend verdicts; UI renders them |
| Navigation, animation, optimistic toggle visuals (rolled back on error) | Frontend |

On any conflict (e.g. toggle shows ON but API returns 403), the backend value wins and the UI rolls back with a human message. Middleware/route guards in the frontend are a **UX convenience**, never the security boundary.

## 5. Security Requirements (V1 baseline)

Every item is testable. IDs are referenced from `pages.md`, `user-flows.md`, and PR checklists.

### 5.1 Session & authentication

| ID | Requirement |
|---|---|
| SEC-AUTH-1 | Session lives only in `httpOnly; Secure; SameSite` cookies set by the backend (prefer `__Host-` prefix, `Path=/`, no `Domain`). JS cannot read it. Frontend never reads, writes, copies, or logs auth cookies or JWTs. |
| SEC-AUTH-2 | Auth state is learned only from `GET /api/v1/user/`. Server-side guards (layout/server component) call it on every protected request; **fail closed** (error, timeout, malformed response → treat as signed out). |
| SEC-AUTH-3 | Next.js middleware may redirect on missing cookie for speed, but must **never be the only check**. Protected data is only fetched after the server-side check succeeds. Pin Next.js to a release patched for the middleware-bypass class of issues (e.g. CVE-2025-29927) and drop `x-middleware-subrequest` at the edge/proxy. |
| SEC-AUTH-4 | Legacy `localStorage` token and `userId=1` are deleted. CI fails if `localStorage`/`sessionStorage` is used for anything except the allowlisted UI prefs in SEC-PRIV-2. |
| SEC-AUTH-5 | Login, signup, forgot, and OAuth failures use generic copy (no account enumeration): same words, same layout, same timing class for existing and non-existing accounts. |
| SEC-AUTH-6 | Password fields: `type="password"`, correct `autocomplete` (`current-password` / `new-password`), paste allowed, min 8 / max 128 (mirror API), show/hide resets to hidden on submit and on blur of the window. Password never logged, put in URL, query cache, or error reports. |
| SEC-AUTH-7 | Sign out is `POST /user/logout` (never GET), then clears all client caches, notifies other tabs (`BroadcastChannel` carrying only a `logout` event), and navigates to `/login`. |
| SEC-AUTH-8 | Sensitive actions (rotate secret, delete account, export data, disconnect app) accept a backend `REAUTH_REQUIRED` verdict and show the re-auth dialog; the action is not retried until the backend confirms. |
| SEC-AUTH-9 | Session expiry mid-use (401) triggers exactly one redirect to `/login` with the “Please log in to continue.” message; no redirect loops; unsaved builder state is held in memory only and is lost on redirect (documented trade-off, no secrets written to storage). |

### 5.2 Redirects (open-redirect, forced-login, loops)

| ID | Requirement |
|---|---|
| SEC-RED-1 | Post-login destination (`next`) is accepted only if, after URL-decoding once and normalizing, it is a **same-origin relative path** matching the frozen app-route allowlist (`pages.md` §Redirect Rules). Everything else → `/dashboard`. |
| SEC-RED-2 | Rejected inputs include: absolute URLs, scheme-relative (`//host`), backslashes (`/\host`, `\\host`), `javascript:`/`data:`, encoded variants (`%2F%2F`, `%5C`), control characters/newlines, whitespace-prefixed values, values > 512 chars, auth pages themselves (`/login`, `/signup`, `/forgot`, `/reset`, `/auth/callback`). Query string and hash are **not** carried over. |
| SEC-RED-3 | The same validator is used for: `/login?next=`, `/signup?next=`, OAuth start (`next` passed to backend as relative path only), and any client-side `router.push` that takes external input. One shared `safeNext()` util with unit tests (vectors in §10). |
| SEC-RED-4 | Authenticated users visiting `/login`, `/signup`, `/forgot` are redirected to `/dashboard`. Unauthenticated users visiting protected routes are redirected to `/login?next=<validated path>`. |
| SEC-RED-5 | Redirect issued at most once per navigation; if the current route is already an auth route, no further redirect. No redirect carries tokens, emails, or error details in the URL. |
| SEC-RED-6 | External links (`target="_blank"`) always include `rel="noopener noreferrer"` and only `http(s)` schemes; user-supplied URLs shown in the UI (HTTP-request action, webhook URL) are displayed as text and, if linked, scheme-checked. |

### 5.3 CSRF, CORS, API transport

| ID | Requirement |
|---|---|
| SEC-CSRF-1 | Every state-changing call (POST/PUT/PATCH/DELETE) carries the backend CSRF token in a custom header (`X-CSRF-Token`) in addition to `SameSite` cookies. No state change is ever performed by GET. |
| SEC-CSRF-2 | Frontend talks to the API through a same-origin path (`/api/v1/*` rewritten to the backend) so cookies stay first-party and the browser origin check is meaningful. No wildcard CORS dependence in the browser. |
| SEC-CSRF-3 | Mutations that create resources (`POST /zap`, `POST /runs/:id/replay`, `POST /zap/:id/test`) send a client-generated `Idempotency-Key` (UUID v4) so double-clicks and retries cannot duplicate. Submit buttons are disabled while pending. |
| SEC-CSRF-4 | Query params to the API are built with `URLSearchParams`; enums (`status`, `active`) are validated against fixed lists; `cursor` is treated as opaque and length-limited; path IDs are validated by pattern before use. |
| SEC-CSRF-5 | 401 → one redirect (SEC-AUTH-9). 403/404 → same “Not found.” (SEC-IDOR-1). 429 → human message plus `Retry-After` countdown, controls re-enabled afterwards. Any 5xx → generic error with Retry; response bodies are never rendered raw. |

### 5.4 XSS, injection, content handling

| ID | Requirement |
|---|---|
| SEC-XSS-1 | All backend strings (error, step input/output, Zap/trigger names, webhook payload samples) render through React text nodes or `<pre>`/`<code>` with escaping. No raw HTML, no Markdown-to-HTML on untrusted data. |
| SEC-XSS-2 | Step input/output viewers are plain-text/JSON viewers, truncated at 100 KB with the “truncated” label, never `eval`ed or parsed as HTML. Large values are virtualized or collapsed to avoid freezing the tab. |
| SEC-XSS-3 | Strict **Content-Security-Policy** (nonce-based, enforced after a report-only soak): `default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'; upgrade-insecure-requests`. Fonts are self-hosted via `next/font` (no Google origin at runtime). |
| SEC-XSS-4 | Lint rules forbid `dangerouslySetInnerHTML`, `eval`, `new Function`, `innerHTML`, `javascript:` URLs (`eslint-plugin-no-unsanitized`, `react/no-danger`). CI fails on violations. |
| SEC-XSS-5 | Route params and search params are never echoed into the DOM unescaped and never into `href`/`src`; `/auth/callback` maps the `error` param through a fixed allowlist to fixed copy (unknown → generic message). |
| SEC-XSS-6 | User-controlled `{{ref}}` mapping tokens are shown as text chips; the UI never evaluates them. |

### 5.5 Secrets & sensitive data

| ID | Requirement |
|---|---|
| SEC-SECRET-1 | The webhook secret is shown **once** (creation or rotation) in component memory only: not in URL, storage, React Query/SWR cache persistence, router state, analytics, or error reports. It is cleared on dialog close, route change, and tab hide. |
| SEC-SECRET-2 | Secret field is masked by default with explicit Reveal and Copy actions (Clipboard API, `Copied` toast); `autocomplete="off"`, no `name` that triggers password managers saving it. |
| SEC-SECRET-3 | Reset tokens (`/reset?token=`) are read once, removed from the address bar with `history.replaceState`, held in memory, sent only in the POST body, never logged. `/reset` sets `Referrer-Policy: no-referrer` and loads no third-party resources. |
| SEC-SECRET-4 | Connection/OAuth tokens never reach the browser; the UI only receives connection status and display name. |
| SEC-SECRET-5 | Only `NEXT_PUBLIC_*` values are used client-side and none are secrets. CI scans the build output for key-like strings. |
| SEC-SECRET-6 | Error reporters (if any) scrub request bodies, headers, cookies, query strings, and any value matching secret patterns before send. |

### 5.6 Authorization UX & IDOR

| ID | Requirement |
|---|---|
| SEC-IDOR-1 | Cross-user IDs (`/zap/[id]`, run IDs) return the same “Not found.” as non-existent ones; the UI never reveals existence, owner, or timing differences. |
| SEC-IDOR-2 | UI never hides data with CSS to “protect” it; data not authorized is never fetched. Role-style gating in the UI is cosmetic and always backed by backend checks. |
| SEC-IDOR-3 | IDs in the URL are validated (`^[A-Za-z0-9_-]{1,64}$`) before being used in a fetch path; invalid → Not found without calling the API. |

### 5.7 Caching & data leakage

| ID | Requirement |
|---|---|
| SEC-CACHE-1 | Authenticated pages and API responses send/accept `Cache-Control: no-store`; user-scoped `fetch` uses `cache: 'no-store'`. Per-user data is **never** stored in Next.js shared/ISR/full-route cache. |
| SEC-CACHE-2 | Client data caches (React Query/SWR) key by user and are fully cleared on logout, 401, and account switch. |
| SEC-CACHE-3 | Back/forward cache: on `pageshow` with `persisted === true` for authenticated routes, revalidate via `GET /user/`; signed-out → `/login`, no stale data flash. |
| SEC-CACHE-4 | Landing `/` is static and identical for everyone; session-aware CTA swaps client-side after `GET /user/` (default CTA = signup). |

### 5.8 Transport & headers (all routes)

`Strict-Transport-Security: max-age=63072000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` (`no-referrer` on `/reset`, `/auth/callback`), `Permissions-Policy` denying camera/mic/geolocation/payment/usb, `Cross-Origin-Opener-Policy: same-origin`, `X-Frame-Options: DENY` (legacy mirror of `frame-ancestors 'none'`), CSP per SEC-XSS-3. TLS only; no mixed content.

### 5.9 Abuse resistance & UX safety

| ID | Requirement |
|---|---|
| SEC-ABUSE-1 | Forms disable submit while pending; client-side throttle on retry buttons; 429 handling per SEC-CSRF-5. Bot protection (CAPTCHA) is backend-optional and, if enabled, uses a first-party-compatible widget allowed in CSP. |
| SEC-ABUSE-2 | Destructive actions (delete account, disconnect, rotate secret) require a confirm dialog; Delete account additionally requires typing the account email or `DELETE`. Confirm button is `destructive` (design-system), never the default focus. |
| SEC-ABUSE-3 | Replay and Test buttons show remaining-limit copy on 429 and never loop retries automatically. |

### 5.10 Supply chain & build

| ID | Requirement |
|---|---|
| SEC-SUP-1 | Lockfile committed; CI runs `npm audit --omit=dev` (fail on high/critical) and dependency review; Dependabot/Renovate on. |
| SEC-SUP-2 | No third-party analytics/CDN scripts in V1. Any later addition needs a PR to this file, CSP update, and SRI. |
| SEC-SUP-3 | Production source maps are not publicly served. `console.*` of API payloads is stripped in production builds. |
| SEC-SUP-4 | Pin Next.js/React to currently supported, patched releases and review security advisories at each release. |

### 5.11 Privacy

| ID | Requirement |
|---|---|
| SEC-PRIV-1 | Show only what the user needs: name, email, connection display names. No raw IDs as headlines (copyable secondary only). |
| SEC-PRIV-2 | `localStorage` is allowed only for non-sensitive UI preferences (`theme`, `sidebarCollapsed`, `historyFilters` without free-text). Wrapped in try/catch; page works without it. |
| SEC-PRIV-3 | `GET /user/export` downloads via an authenticated request that streams to a Blob URL revoked right after download; the file is not cached. |

## 6. Threat Model Summary

| Threat | Vector in this product | Primary controls |
|---|---|---|
| Account takeover | Credential stuffing, session theft, reset-link leak | Generic errors, backend rate limits, `httpOnly` cookies, token scrub + `no-referrer` on `/reset`, re-auth on sensitive actions |
| Session theft via XSS | Rendered step output/error, Zap names, URLs | Text-only rendering, strict CSP, lint bans, no tokens in JS |
| CSRF | Cross-site POST to `/zap`, `/logout`, `/replay` | CSRF header + SameSite + same-origin API path, no GET mutations |
| Open redirect / phishing | `/login?next=https://evil` | `safeNext()` allowlist, no query carry-over |
| Auth-bypass | Middleware-only guard, client-side flags | Server-side `GET /user/` guard, fail closed, patched Next.js |
| IDOR / enumeration | `/zap/<other id>`, signup/forgot responses | Uniform Not found + generic copy, ID validation |
| Secret exposure | Webhook secret, reset token, connection tokens | Memory-only once-display, token scrub, no tokens client-side |
| Data leakage between users | Shared cache, bfcache, stale back-button | `no-store`, user-keyed caches, `pageshow` revalidate, clear on logout |
| Clickjacking | Framing `/settings`, `/zap/*` | `frame-ancestors 'none'`, `X-Frame-Options` |
| Supply chain | npm packages, third-party scripts | Audit gates, lockfile, no third-party scripts |
| Resource abuse | Large payload rendering, rapid retries | 100 KB cap, virtualization, disabled-while-pending, 429 UX |

## 7. Responsive / Accessibility / Loading-Error Rules

- Dashboard and builder are mobile-first; history table is desktop-dense with horizontal scroll on small screens; every touch target ≥44px (design-system §8).
- Semantic HTML, visible focus rings (`focus` token), labeled controls, live regions for run-status changes and toast results, status never color-only (icon + text; design-system §1).
- Every fetch shows skeleton → content | empty-state | error-with-retry. Errors are human sentences from `content.md`; backend codes are secondary and muted and never include traces.
- Security UX is accessible: redirect messages announced via live region; re-auth and confirm dialogs trap focus; secrets are announced as “hidden” and never read aloud unless revealed.

## 8. Design-System v2 Reconciliation

v2 introduces patterns that conflict with frozen scope or labels. Decisions (design-system.md is not edited; these rules override at implementation):

| v2 design element | V1 decision |
|---|---|
| Header link `Pricing`; “Plan / Free plan” label; usage meter in sidebar | **Dropped** (no pricing/billing; `grep -ri pricing apps/web` must be empty) |
| `Templates` nav + Templates preview section on landing | **Dropped** (no route; no data source) |
| `Docs` / `Product` header links | **Dropped** in V1 (no route). Landing uses in-page anchors only (`How it works`, `FAQ`) |
| Workspace switcher | **Replaced** by a static account chip (name + email, user menu with Settings / Sign out). No workspaces in V1 |
| CTA copy `Start free`, `New automation` | **Replaced** by `Create automation` everywhere (never rename) |
| Dashboard H1 `Dashboard` | H1 is `My automations`; nav item label stays `Dashboard` |
| ⌘K command palette | **V1-lite:** navigation to frozen routes + search over loaded automations. No new endpoints; no actions that mutate |
| Announcement bar | Optional, static text only, no external link |
| Landing metrics strip | Only real values from backend/BRD or labelled placeholders; hidden until real |
| FAQ | No plan/pricing questions; copy from `content.md` |
| Theme toggle | Visible but light-only in V1 (dark tokens reserved) |
| Right rail “Getting started” | Derived from backend data (has automation? has runs?); no client-only flags |
| Right rail “Needs attention” | Derived from `GET /dashboard` failed/suspended; no invented counts |
| Analytics | Stays at frozen `/analytics`; add as sidebar item `Analytics`; charts use `GET /dashboard` only |
| Connections | Section of `/settings` (`#connections`), not a route |

## 9. V1 Out of Scope

Per `PRD.md` §6 and `BRD.md` §4: team sharing/workspaces, Zap versioning UI beyond revision-conflict handling, branching/paths UI, usage billing/payments/pricing page, mobile app, multi-region behavior, unrestricted theming (light theme tokens only), push notifications, third-party analytics, in-browser secret storage, MFA UI (backend-ready: handle `MFA_REQUIRED` verdict as generic failure until specified).

## 10. Definition of Done

Planning is sufficient when implementation can begin without inventing routes, flows, component behavior, responsive rules, tokens, user-facing copy, or security behavior. Code is done when:

1. All 8 frozen routes (+ `/forgot`, `/reset`, `/auth/callback`) render real data; legacy bugs (`userId=1`, hardcoded dates, `localStorage` token) are gone; `grep -ri pricing apps/web` is empty.
2. **Redirect tests (unit + Playwright)** pass for `safeNext()` with at least: `https://evil.com`, `//evil.com`, `/\evil.com`, `\\evil.com`, `/%2F%2Fevil.com`, `/%5Cevil.com`, `javascript:alert(1)`, `data:text/html,x`, `/dashboard%0d%0aSet-Cookie:x`, ` /dashboard`, `/login?next=/login`, a 600-char path, `/zap/..%2Fadmin`, plus valid `/dashboard`, `/history`, `/zap/create`, `/zap/abc_123`, `/settings`.
3. **Auth-gate tests:** unauthenticated hit on every protected route → `/login?next=…`; authenticated hit on `/login|/signup|/forgot` → `/dashboard`; 401 mid-session → single redirect, no loop; back button after Sign out shows no cached data; another tab signs out when one tab does.
4. **XSS tests:** payloads such as `<img src=x onerror=alert(1)>` and `"><script>` in Zap name, step output, error string, and `/auth/callback?error=` render inert text; CSP violation reports are empty in the E2E run.
5. `grep` gates empty: `dangerouslySetInnerHTML`, `eval(`, `new Function`, `innerHTML`, `localStorage.*token`, `document.cookie`.
6. Header scan (e.g. `curl -I`/ZAP baseline) shows all SEC-8 headers; CSP enforced in production; `npm audit --omit=dev` has no high/critical.
7. Secret handling test: webhook secret never appears in DevTools Application storage, URL, network request URLs, or React Query cache snapshot after navigation.
8. Every gate in `pages.md` and `user-flows.md` passes.

---

**Status:** DRAFT v2
**Freeze rule:** Colors, type, spacing, radii, depth, and motion come from `design-system.md` v2 tokens only. Security requirements here may be tightened but not relaxed without a PRD update. No new visual language without a PRD update.
