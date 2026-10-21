# Zapier-Monorepo Frontend — V1 Requirements

> **Document:** `docs/phase-04-frontend-planning/requirements.md`
> **Status:** DRAFT v3 — aligned to `design-system.md` v3 (transcribed from the Canva design file `Zapier-Monorepo Web App Design v2.html`), security-hardened
> **Purpose:** Define exactly what the V1 frontend must provide, what is intentionally outside V1, and the security baseline every screen must meet. Product truth lives in `docs/BRD.md`, `docs/PRD.md`, `docs/TRD.md`, `docs/DATAFLOW.md`. This file must not contradict them.
> **v3 changes:** (1) the Canva design file is now the source of truth for the visual layer — §8 becomes a two-authority reconciliation table (design = craft, PRD/BRD = scope), (2) new §8.2 additions the design requires but does not draw (workflow summary in the builder, `Analytics` nav item), (3) design-parity gates in §10, (4) mobile behaviour per the `07 Mobile + states` canvas, (5) §2/§3/§7 updated for the builder-shell edit mode and the inline run-detail panel.

## 1. Frontend Goal

V1 demonstrates one coherent automation product:

```text
Signup/Login → Dashboard → Create automation (trigger → actions → Publish)
→ Fire webhook / schedule runs → History → Inspect failure → Retry
```

The frontend must feel like a shipped SaaS product (design-system v3: warm paper/ink, one flame accent, shadcn-style components, transcribed exactly from the Canva design file), not a collection of developer pages. It reuses the working legacy flows (landing, auth split layout, dashboard table, zap-create builder), wires every mock to real backend data, and **fails closed**: when auth state is unknown or a check errors, the user is treated as signed out.

## 2. The Three Experiences

### Experience A — Builder (create + edit)

The user picks 1 trigger (`webhook`, `schedule`, `github-poll`, `rss-poll`, `manual`) and N ordered actions (`email`, `slack`, `discord`, `http-request`, `delay`, `filter`), configures each step, maps fields via `{{step.output.*}}` dropdowns against 3 `test-trigger` samples, connects Gmail/GitHub apps where required, and publishes.

```text
Pick trigger → Configure (+ Test trigger samples) → Add action(s)
→ Map fields → Review → Publish
```

Layout (design-system §6.4): step library left (260px), dotted canvas center, 320px inspector right; top bar with editable name, saved indicator, Test, **Publish**. The canvas is a **vertical** stack of 300px node cards joined by vertical 1.5px connectors with a 22px `+` insert handle. Edit (`/zap/[id]`) is the same builder shell bound to `GET /zap/:id`, saving with `If-Match: revision` (409 → reload prompt). In-flight runs stay pinned to the old revision — the UI must say so after Publish.

### Experience B — Workflow Detail (`/zap/[id]`)

One route, one screen: the **builder shell in edit mode**. The design file has no separate detail canvas, and `/zap/[id]` is the only frozen route that can host the editor (there is no `/zap/[id]/edit`), so detail and edit are the same screen. It answers: what does this automation do (the canvas node stack — trigger + ordered actions read from the backend, never static), is it on (active toggle), and how do I reach its runs (History filtered to this Zap).

The PRD-required summary capabilities that the design does not draw live in surfaces the design **already defines**: the active toggle, webhook URL, secret (shown once) and rotate action sit in the inspector **Settings** tab (design-system §6.4), and recent runs are reached through History pre-filtered to this Zap (`GET /zap/:id/runs`; PRD F-7, F-12). See `requirements.md` §8.3 (additions A1–A2) — this is the only sanctioned addition to the drawn design.

### Experience C — History / Ops (`/history` + run detail)

The operations surface. Dense table of runs (`status`, Zap name, latency, error, time), filters (`search`, `status`, Zap), cursor pagination, and a **480px inline run-detail panel** beside the table — not an overlay drawer; on narrow screens it becomes a full-screen sheet — with step timeline (`ZapRunStep[]`: input/output ≤100KB, latency) plus Replay (`POST /runs/:id/replay`) for FAILED/DLT runs. Runs are retained 90 days — the UI states this where history could look empty.

## 3. Must / Must-Not

**Must:**

- Wire every page to the contracts in `pages.md`; no static mock rows, dates, or user data.
- Implement the UI by **transcribing** `design-system.md` v3 — the same tokens, component anatomy, layout, copy and states as the design file. No approximation, no paraphrasing of the design.
- Stay inside the design's component vocabulary (shadcn/Radix primitives + Lucide icons + the tokens in design-system §2). A new visual pattern needs a PR to `design-system.md` first.
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
- No pricing or billing logic or UI anywhere (design elements that imply billing are dropped — §8).
- Never render an element the PRD excludes (pricing links, Templates route/section, plan or usage meter, workspace switcher) — not even as a disabled placeholder.
- Never hardcode the design file's illustration values (`Acme Ops`, `Maya Rao`, `hooks.zapflow.app/catch/8f2a91`, `1,284 / 2,000`, `run_8f2a91`, `2 / 4`) — they are samples, not data.
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

- Dashboard and builder are mobile-first; history table is desktop-dense with horizontal scroll on small screens (first column sticky); every touch target ≥44px (design-system §9).
- **Mobile (390px) follows the `07 Mobile + states` canvas exactly** (design-system §9): 56px white header (logo + page title + 44px search), content padding 16px, stat cards in a 2-column grid, automations as **stacked cards** (not a scrolling table), **64px bottom tab bar** (Dashboard, Create, History, Settings); builder library and inspector open as bottom sheets; landing H1 40px with stacked full-width CTAs; the run-detail panel becomes a full-screen sheet.
- Semantic HTML, visible focus rings (`focus` token), labeled controls, live regions for run-status changes and toast results, status never color-only (icon + text; design-system §2 status palette, §7 icons).
- Every fetch shows skeleton → content | empty-state | error-with-retry, using the **exact card anatomy** in design-system §8 (dot-grid empty card, tinted error card, `Copied` toast). Where the design gives literal copy, use it verbatim (`No automations yet`, `Create your first automation and its runs will show up here.`, `We couldn't load your runs`, `Check your connection and try again.`, `Retry`, `Contact support`). Other errors are human sentences from `content.md`; backend codes are secondary and muted and never include traces.
- Security UX is accessible: redirect messages announced via live region; re-auth and confirm dialogs trap focus; secrets are announced as “hidden” and never read aloud unless revealed.

## 8. Design-System v3 ↔ Scope Reconciliation

### 8.1 Precedence

| Layer | Authority | Rule |
|---|---|---|
| Visual layer — tokens, type, spacing, radii, depth, layout, component anatomy, motion, screen copy, screen states | **The Canva design file** (`Zapier-Monorepo Web App Design v2.html`), transcribed in `design-system.md` v3 | The design wins. Implementation transcribes; it does not reinterpret. |
| Product scope — which routes and features exist at all | `docs/PRD.md`, `docs/BRD.md` | The PRD/BRD win. A design element that implies an excluded feature is **not built**; the table below records the decision. |
| Behaviour, security, data, backend wiring | `pages.md`, `user-flows.md`, `docs/TRD.md`, `docs/DATAFLOW.md`, §5 below | Unchanged by the design. |

This section is the **single place** where a design element is rejected or adapted. `pages.md` and `design-system.md` reference it; they do not repeat it.

### 8.2 Reconciliation table

| Canvas | Design element | V1 decision | Authority |
|---|---|---|---|
| Landing | Header links `Product`, `Templates`, `Pricing`, `Docs` | **Dropped** — no routes. Header = logo + in-page anchors (`How it works`, `FAQ`) + `Log in` + `Create automation` | PRD §5 "about the project only, no pricing anywhere"; PRD §6 |
| Landing | `Templates` preview section | **Dropped** — no route, no data source | PRD §5, §6 |
| Landing | Hero primary `Start free` | **Replaced** by `Create automation` (never rename a working label) | `content.md` |
| Landing | Hero secondary `See a live run` | **Kept** — in-page anchor to the run-log bento tile (`/#runs`) | design |
| Landing | Hero card webhook URL `https://hooks.zapflow.app/catch/8f2a91` | **Never hardcoded** — rendered from the backend `webhookUrl` (`HOOKS_URL`) | TRD, DATAFLOW |
| Landing | Integration marquee with brand logos | **Generic integration names only** — no third-party logos/assets, no third-party scripts | SEC-SUP-2 |
| Landing | Metrics strip (`1,284`, `2,000`, …) | **Real values only**; hidden until real data exists | BRD |
| Landing | FAQ section | **Kept**, minus any plan/pricing questions | PRD §5 |
| Landing | Footer columns `Product / Resources / Company` | **3 columns**, no pricing links; `Resources`/`Company` entries are inert placeholders (no routes exist) | PRD §6 |
| Landing | Brand `Zapflow` | **Adopted** as the user-facing product name; `Zapier-Monorepo` stays the technical/repo name | user decision |
| Auth | Split layout (form left, product vignette right on dot grid) | **Kept exactly** — 52/48, vignette hidden below `lg` | design |
| Auth | Vignette headline `Every run, step by step.` + a **failed** run timeline | **Kept** — static product copy only, no user data | design, SEC-PRIV-1 |
| Auth | Google + GitHub buttons side by side | **Kept** — each with an explicit `aria-label` | design, PRD F-1 |
| Auth | Signup name field + password strength bar | **Kept** — the bar is **advisory only** and never blocks submit; the server rule (min 8) wins | design, PRD F-1 |
| Auth | `Log in` / `Create account` labels | **Kept** | design |
| Dashboard | H1 `Dashboard` | H1 is `My automations`; the sidebar item label stays `Dashboard` | `content.md` |
| Dashboard | Header primary `New automation ⌘N` | **Replaced** by `Create automation ⌘N` | `content.md` |
| Dashboard | Header secondary `Docs` | **Dropped** — no route. The page header keeps only `Create automation` | PRD §6 |
| Dashboard | Sidebar `Acme Ops ▾ / Free plan` (workspace switcher) | **Dropped** — replaced by the account chip (avatar, name, email, sign out) | PRD §6 (no teams/workspaces) |
| Dashboard | Sidebar usage meter `Runs this month 1,284 / 2,000` | **Dropped** | PRD §6 (no usage billing) |
| Dashboard | Sidebar `Templates` | **Dropped** | PRD §5, §6 |
| Dashboard | Sidebar `Analytics` (absent from the design) | **Added** at the frozen `/analytics`; data from `GET /api/v1/analytics?window=7d\|30d\|90d` (same payload as `/dashboard`) | PRD F-7, TRD §5.1 #5 |
| Dashboard | Sidebar `Connections` (absent from the design) | `/settings#connections` — a section of `/settings`, not a route | PRD §5, F-10 |
| Dashboard | `Runs per day` chart — Succeeded (ink) / **Failed `#DC2626`** bars, 7d/30d/90d tabs | **Kept exactly** — `#DC2626` is the dataviz token, distinct from the status-failed red | design §2 |
| Dashboard | Right rail `Needs attention`, `Getting started 2 / 4` | **Derived from backend data only** (`GET /api/v1/dashboard`); no invented counts, no client-only flags | PRD F-7 |
| Dashboard | Automations table columns Name / Steps / On / Last run / Status | **Kept** — `Last run` is 12px mono from real run data; the `On` column is the active toggle | design, PRD F-14 |
| Dashboard | Failed row `#FFFBFA` + error sentence + `View step` | **Kept** | design |
| History | Run detail as a 480px **overlay drawer** (PRD wording) | Design's **480px inline side panel** beside the table; on narrow screens it becomes a full-screen sheet | PRD F-12 (capability) + design (rendering) |
| History | Grouped sidebar | **Flat** variant on history (logo + workspace name + flat nav, same 32px items and active treatment) | design |
| History | Filter chips `Status 2`, `All automations`, `Last 30 days` | **Kept** — the Zap filter lives in the `All automations` chip | design, PRD F-14 |
| History | Footer `1–25 of 1,284 · runs are kept for 90 days` | **Kept** — counts from the backend; the 90-day retention copy is mandatory | design, PRD F-14 |
| History | `Retry run`, `Copy ID`, `Retry from this step`, `Check connection` | **Kept** — Replay only for FAILED/DLT, rate-limited, never auto-looping | design, PRD F-11 |
| Builder | Canvas connectors as curves | **Vertical** 1.5px rules with a 22px `+` insert handle | design |
| Builder | Node card width 280px | **300px** | design |
| Builder | Inspector `Setup / Test / Settings` tabs | **Kept** — the `Settings` tab additionally hosts the workflow summary (§8.3) | design, PRD F-3/F-14 |
| Builder | `Draft` badge + `Saved · 12:04` | **Kept** — badge reflects real publish state, timestamp reflects the real save time | design |
| Builder | `Publish ⌘↵` | **Kept** — `⌘↵` submits; the request carries CSRF + `Idempotency-Key` | design, PRD F-3 |
| Global | Compact nav label `Create` (dashboard groups, history flat nav, mobile tab bar) | **Expanded** to `Create automation` — a working label is never renamed | `content.md` |
| Global | Dark theme | **Reserved** — dark tokens defined, light only in V1; `ThemeToggle` present but light-only | design §10 |
| Global | `⌘K` palette in the top bar | **V1-lite** — navigate to frozen routes + search loaded automations; no new endpoints, no mutating actions | design, no backend change |
| Global | Announcement bar | Optional, static text only, no external link | PRD §5 |
| Global | Geist Sans / Geist Mono | Loaded via `next/font` (self-hosted, no Google origin at runtime) | design §2, SEC-XSS-3 |

### 8.3 Sanctioned additions (PRD requires, the design does not draw)

These are the **only** additions to the drawn design. They use existing design components and add no new visual language.

| # | Addition | Where it lives | Authority |
|---|---|---|---|
| A1 | **Workflow summary** — active toggle, webhook URL, secret (shown once), rotate secret | Builder inspector, **Settings** tab (`/zap/[id]`) | PRD F-3, F-4, F-14 |
| A2 | **Recent runs entry point** — History pre-filtered to this Zap (`?zap=`) | Builder inspector, Settings tab | PRD F-7, F-12 |
| A3 | **`Analytics` nav item** | App sidebar → frozen `/analytics`, reusing the dashboard chart card | PRD F-7 |
| A4 | **`Connections` nav item** | App sidebar → `/settings#connections` | PRD §5, F-10 |
| A5 | **Folder filter** (design shows search only) | Automations card header, next to search, using the design's filter-chip component | PRD §5 ("folders + search + active toggle") |
| A6 | **⌘K command palette** | Top bar search button | design top bar + no new endpoints |
| A7 | **Step / run I/O code wells** — step input/output as truncated mono text | Run-detail panel (history) and builder test panel | PRD F-12, SEC-XSS-1/2 |

### 8.4 Never build (explicit exclusions)

| Excluded | Reason | Gate |
|---|---|---|
| Pricing page, pricing links, plan badges, upgrade prompts | PRD §5/§6, BRD — no billing | `grep -ri pricing apps/web` is empty |
| Templates route, nav item, landing section, preview card | PRD §5/§6 — no route, no data source | no `/templates` link or route |
| Workspace switcher, `Free plan`, plan labels | PRD §6 — no teams/workspaces | no workspace switcher component |
| Sidebar usage meter / quota bar | PRD §6 — no usage billing | no quota component |
| `Docs` / `Product` header links | no route in `pages.md` | links point only to in-page anchors |
| Dark theme in V1 | reserved in design §10 | only light tokens applied |
| MFA UI | PRD — backend-ready only; `MFA_REQUIRED` renders as a generic failure | no MFA screen |
| Third-party scripts, logos, analytics, CDN | SEC-SUP-2, SEC-XSS-3 | CSP has no third-party origins; `npm run build` output scanned |

## 9. V1 Out of Scope

Per `PRD.md` §6 and `BRD.md` §4: team sharing/workspaces, Zap versioning UI beyond revision-conflict handling, branching/paths UI, usage billing/payments/pricing page, mobile app, multi-region behavior, unrestricted theming (light theme tokens only), push notifications, third-party analytics, in-browser secret storage, MFA UI (backend-ready: handle `MFA_REQUIRED` verdict as generic failure until specified).

Everything in §8.4 is likewise out of scope for V1: no pricing/billing, no Templates, no workspace switcher, no usage meter, no `Docs`/`Product` header links, no dark theme, no third-party scripts or logos.

## 10. Definition of Done

Planning is sufficient when implementation can begin without inventing routes, flows, component behavior, responsive rules, tokens, user-facing copy, or security behavior. Code is done when:

1. All 12 frozen routes in `pages.md` render real data; legacy bugs (`userId=1`, hardcoded dates, `localStorage` token) are gone; `grep -ri pricing apps/web` is empty.
2. **Redirect tests (unit + Playwright)** pass for `safeNext()` with at least: `https://evil.com`, `//evil.com`, `/\evil.com`, `\\evil.com`, `/%2F%2Fevil.com`, `/%5Cevil.com`, `javascript:alert(1)`, `data:text/html,x`, `/dashboard%0d%0aSet-Cookie:x`, ` /dashboard`, `/login?next=/login`, a 600-char path, `/zap/..%2Fadmin`, plus valid `/dashboard`, `/history`, `/zap/create`, `/zap/abc_123`, `/settings`.
3. **Auth-gate tests:** unauthenticated hit on every protected route → `/login?next=…`; authenticated hit on `/login|/signup|/forgot` → `/dashboard`; 401 mid-session → single redirect, no loop; back button after Sign out shows no cached data; another tab signs out when one tab does.
4. **XSS tests:** payloads such as `<img src=x onerror=alert(1)>` and `"><script>` in Zap name, step output, error string, and `/auth/callback?error=` render inert text; CSP violation reports are empty in the E2E run.
5. `grep` gates empty: `dangerouslySetInnerHTML`, `eval(`, `new Function`, `innerHTML`, `localStorage.*token`, `document.cookie`.
6. Header scan (e.g. `curl -I`/ZAP baseline) shows all SEC-8 headers; CSP enforced in production; `npm audit --omit=dev` has no high/critical.
7. Secret handling test: webhook secret never appears in DevTools Application storage, URL, network request URLs, or React Query cache snapshot after navigation.
8. Every gate in `pages.md` and `user-flows.md` passes.
9. **Design-parity gate:** every route is screenshotted at 1440px and 390px and reviewed against its canvas in the design file — tokens, component anatomy, copy, and states match; the only deviations are the ones recorded in §8.2/§8.3.
10. **Scope-exclusion gate:** §8.4 elements are absent from the DOM and the bundle — `grep -ri "pricing\|free plan\|templates\|acme ops\|maya rao\|hooks.zapflow.app" apps/web` returns nothing; no `href="/templates"`, no workspace switcher, no quota meter.
11. **No hardcoded sample data:** the design's illustration values (`1,284`, `2,000`, `run_8f2a91`, `2 / 4`) appear only in fixtures, never in rendered output; the webhook URL is rendered from the backend response.

---

**Status:** DRAFT v3
**Freeze rule:** Colors, type, spacing, radii, depth, layout, motion, component anatomy and screen copy come from `design-system.md` v3 (the Canva design file) only. Scope comes from `PRD.md`/`BRD.md`, reconciled in §8. Security requirements here may be tightened but not relaxed without a PRD update. No new visual language without a PR to `design-system.md`.
