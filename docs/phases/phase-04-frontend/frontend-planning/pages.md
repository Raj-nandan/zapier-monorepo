# Zapier-Monorepo Frontend — Frozen Route Map

> **Document:** `docs/phase-04-frontend-planning/pages.md`
> **Status:** DRAFT v2 — aligned to `design-system.md` v2, secure routing
> **Purpose:** Freeze every V1 route. No route may be added, removed, or renamed without a PRD update. Data wiring per route is mandatory — static mocks from legacy (`zap/[id]`, `history`, `settings`) must be replaced with the listed backend calls. v2 adds the **auth gate**, **redirect rules**, **cache policy**, and **security notes** per route (see `requirements.md` §5 for IDs).

## Full Route Table

| Route | Access | Auth gate | Backend reads | Backend writes | Cache |
|---|---|---|---|---|---|
| `/` | Public | None (CTA swaps client-side after session check) | None (static about content); optional `GET /api/v1/user/` for CTA | None | Static, shared |
| `/login` | Public-only (authed → `/dashboard`) | Redirect if session | `GET /api/v1/user/` (session check) | `POST /api/v1/user/signin`, `GET /api/v1/auth/google\|github` | `no-store` |
| `/signup` | Public-only (authed → `/dashboard`) | Redirect if session | Session check | `POST /api/v1/user/signup`, OAuth starts | `no-store` |
| `/forgot` | Public-only | Redirect if session | None | `POST /api/v1/user/forgot` | `no-store` |
| `/reset` | Public (token required) | None; invalid/missing token → expired copy | None | `POST /api/v1/user/reset` | `no-store`, `Referrer-Policy: no-referrer` |
| `/auth/callback` | Public (error display only) | None | None | None (cookies already set by backend redirect) | `no-store`, `no-referrer` |
| `/dashboard` | Auth | Server guard → 401 `/login?next=/dashboard` | `GET /api/v1/dashboard`, `GET /api/v1/zap?search&folderId&active` | `PATCH /api/v1/zap/:id/active` | `no-store` |
| `/zap/create` | Auth | Server guard | `GET /api/v1/trigger/available`, `GET /api/v1/action/available`, `POST /api/v1/zap/test-trigger`, `GET /api/v1/connections` | `POST /api/v1/zap` | `no-store` |
| `/zap/[id]` | Auth, owner only | Server guard + ID pattern check; non-owner → Not found | `GET /api/v1/zap/:id`, `GET /api/v1/zap/:id/runs?limit=5`, `POST /api/v1/zap/test-trigger` | `PUT/PATCH /api/v1/zap/:id` (`If-Match`), `PATCH /:id/active`, `POST /zap/:id/secret/rotate`, `POST /zap/:id/test` | `no-store` |
| `/history` | Auth | Server guard | `GET /api/v1/zap/:id/runs?search&status&cursor&limit`, `GET /api/v1/runs/:id` (steps) | `POST /api/v1/runs/:id/replay` | `no-store` |
| `/analytics` | Auth | Server guard | `GET /api/v1/dashboard` (charts data) | None | `no-store` |
| `/settings` | Auth | Server guard | `GET /api/v1/user/`, `GET /api/v1/connections` | `POST /zap/:id/secret/rotate`, connections connect/disconnect, `GET /api/v1/user/export`, `DELETE /api/v1/user`, `POST /api/v1/user/logout` | `no-store` |

PRD-required auth support routes (F-1, not new inventions): `/forgot`, `/reset?token=`, `/auth/callback`. Special framework files (`not-found`, `error`, `global-error`, `loading`) are not routes.

## Layout Groups (design-system v2 shells)

| Group | Routes | Shell |
|---|---|---|
| `(marketing)` | `/` | Marketing header (logo, in-page anchors, `Log in`, `Create automation`), hero + dot grid, footer. No sidebar. |
| `(auth)` | `/login`, `/signup`, `/forgot`, `/reset`, `/auth/callback` | Split layout (form left, product vignette right ≥lg). `forgot`/`reset`/`callback` use left column only with centered icon chip. |
| `(app)` | `/dashboard`, `/analytics`, `/history`, `/settings`, `/zap/*` | Dashboard shell: sidebar 248px (collapses to rail <lg, sheet + bottom tab bar on mobile), top bar 56px (breadcrumb, search/⌘K-lite, theme toggle, account menu). `/zap/create` and `/zap/[id]` use the builder shell (own top bar, library, canvas, inspector). |

The `(app)` layout performs the server-side session check (`GET /api/v1/user/`) once per request, **fails closed**, and passes the user object down. Children never re-derive auth from cookies, URL, or storage.

## Navigation Map (v2 → frozen routes)

| Nav item (label) | Route | Notes |
|---|---|---|
| Dashboard | `/dashboard` | H1 on page is `My automations` |
| Create automation | `/zap/create` | Primary button; also sidebar item `Create` |
| History | `/history` | |
| Analytics | `/analytics` | Added to sidebar to match frozen route |
| Connections | `/settings#connections` | Section, not a route |
| Settings | `/settings` | |
| Account menu → Sign out | `POST /user/logout` | Never a link/GET |
| Marketing: `How it works`, `FAQ` | `/#how`, `/#faq` | In-page anchors only |

Dropped from v2 design: `Pricing`, `Templates`, `Docs`, `Product` links, workspace switcher, plan/usage meter (see `requirements.md` §8).

## Redirect Rules (secure & authenticated)

### Decision table

| Situation | Behavior |
|---|---|
| Unauthenticated → protected route | Redirect to `/login?next=<safe path>`; show `Please log in to continue.` |
| Authenticated → `/login`, `/signup`, `/forgot` | Redirect to `/dashboard` (no `next`) |
| Authenticated → `/reset?token=` | Allowed (token verdict from backend); after success the user is signed out by backend and sent to `/login` with success copy |
| Login / signup / OAuth success | Redirect to `safeNext(next)` else `/dashboard` |
| 401 mid-session (any API call) | Clear caches, one redirect to `/login?next=<current safe path>` with `Please log in to continue.`; ignored if already on an auth route |
| 403 / 404 on `/zap/[id]` or run | Render `Not found.` in place (no redirect, identical for cross-user IDs) |
| Sign out | `POST /user/logout` → clear caches → `/login` with `You have been signed out.` (no `next`) |
| Session-check error/timeout on protected route | Treated as signed out (fail closed) |
| `/` while signed in | Page stays; header CTA becomes `Dashboard`; no forced redirect |

### `safeNext()` allowlist (single shared util)

Accept `next` only if all hold after decoding **once** and trimming nothing (leading whitespace rejects):

1. Length ≤ 512, no control characters, no backslash, no `//` at start, no scheme (`:` before first `/`).
2. Starts with exactly one `/`.
3. Pathname (query/hash stripped) matches one of:
   `^/dashboard$` · `^/analytics$` · `^/history$` · `^/settings$` · `^/zap/create$` · `^/zap/[A-Za-z0-9_-]{1,64}$`
4. Never an auth route (`/login`, `/signup`, `/forgot`, `/reset`, `/auth/callback`).

Result is the pathname only (query and hash dropped). Anything else → `/dashboard`. The OAuth start passes only this validated relative path to the backend; the backend must re-validate (frontend check is not the boundary).

## Per-Route Spec

### `/` — Landing (public)

- **Role:** marketing. **Purpose:** explain the project (about only) and route to signup/dashboard.
- **v2 layout:** hero left-aligned with live workflow card, integration marquee (generic names, no logos), bento tiles with real UI fragments, 3-step flow, FAQ, ink CTA band, footer. No pricing section; no templates section; metrics only if real.
- **Primary actions:** `Create automation` (accent button, one per view) → `/signup`, or `/dashboard` when logged in; `Log in` → `/login`.
- **UI states:** static content + session-aware CTA (default signup; swap after `GET /user/`; failures keep the signup default).
- **Security:** no third-party scripts; no personalized HTML cached; external links `rel="noopener noreferrer"`.
- **Access:** public; header shows Dashboard + Sign out when a session exists.

### `/login`, `/signup` (public-only)

- **Role:** auth. **Purpose:** credential + OAuth entry using design-system §4 split layout (legacy line “Join millions worldwide who automate their work.” + checklist panel, with the product vignette).
- **Primary actions:** email form (react-hook-form + Zod), Google button, GitHub button, `Forgot password?` (login only). Signup adds name + password strength bar (advisory only).
- **UI states:** idle → submitting (disabled, spinner) → success (cookie set, → `safeNext` or `/dashboard`) | generic error (no enumeration). OAuth failures show provider message from the fixed allowlist.
- **Security:** `autocomplete` attributes; no password in URL/state; submit disabled while pending; 429 shows retry countdown; `next` validated by `safeNext()`; CSRF header on POST; no third-party scripts.
- **Access:** logged-in visits redirect to `/dashboard`.

### `/forgot` (public-only)

- **Purpose:** request reset link. **Action:** email → `POST /user/forgot` → always the same success copy.
- **Security:** identical response/UI for known and unknown emails; submit throttled; no email echoed back in the URL.

### `/reset` (token)

- **Purpose:** choose a new password (≥8).
- **Flow:** read `token` once → `history.replaceState` to remove it from the URL → keep in memory → `POST /user/reset` body. Missing/invalid/expired → `This reset link is invalid or expired. Request a new one.` with link to `/forgot`.
- **Security:** `Referrer-Policy: no-referrer`, `no-store`, no third-party resources; token never logged or stored; password rules same as signup.

### `/auth/callback` (error display only)

- **Purpose:** show OAuth failure. Session arrives via `httpOnly` cookies set by the backend redirect.
- **Security:** `error` param mapped through a fixed allowlist (`access_denied`, `provider_error`, `state_mismatch`, `unknown`) to fixed copy; param is never rendered or placed in an href; query string stripped from the URL after read; success path (no error) immediately redirects to `safeNext`/`/dashboard` after the session check.

### `/dashboard` (auth)

- **Role:** home. **Purpose:** `My automations — Manage and monitor your workflows`: search, active toggle, table, stat cards, runs chart, right rail.
- **v2 layout:** page header (`My automations`, `Create automation`), 4 stat cards (+ sparkline), runs-per-day chart card with 7d/30d/90d tabs, automations table card, right rail (Needs attention, Getting started derived from backend data) on ≥xl.
- **Primary actions:** Create automation (→ `/zap/create`), folder filter, search, per-row enable/disable toggle (optimistic, rollback on error), open Zap, copy webhook URL.
- **UI states:** skeleton table → rows | empty (`No automations yet.` + Create CTA) | error + retry. Toggle rolls back if the backend rejects.
- **Security:** names/URLs rendered as text; `search` URL-encoded; active toggle sends CSRF header; no per-user data in shared cache.
- **Access:** auth; 401 → `/login`. Fixes legacy `userId=1` (uses `GET /user/`) and hardcoded dates (uses `createdAt`).

### `/zap/create` (auth)

- **Role:** builder. **Purpose:** trigger → configure (+ samples) → actions → map → Publish.
- **v2 layout:** library left, dotted canvas, inspector right; top bar with name, saved indicator, Test, **Publish**.
- **Primary actions:** pick trigger, Test trigger (3 samples, no run), add/configure/remove actions, connect app when required, Publish.
- **UI states:** pristine → configuring → validating (Zod, `{{ref}}` check) → publishing → success (→ `/zap/[id]`, secret shown once in memory) | field error | rate-limit message (20/day).
- **Security:** `Publish` sends CSRF + `Idempotency-Key`; HTTP-request action URLs shown as text and validated `http(s)`; sample payloads rendered as text; secret handled per SEC-SECRET-1/2; unsaved draft held in memory only.
- **Access:** auth; unavailable slugs disabled with reason.

### `/zap/[id]` (auth, owner)

- **Role:** workflow detail. **Purpose:** what it does, is it on, did it work — fully from `GET /zap/:id` (legacy static mock deleted).
- **Primary actions:** Edit + Publish changes (`If-Match`, 409 → reload prompt), active toggle, Test (synthetic run), copy webhook URL, rotate secret (confirm + possible re-auth), open recent run in History, Replay a failed run.
- **UI states:** loading → detail | `Not found.` (including cross-user IDs — same copy) | conflict notice | “Edited elsewhere — in-flight runs use revision N”.
- **Security:** `[id]` pattern-validated before any fetch; webhook secret never shown after creation/rotation; rotation shows the new secret once.
- **Access:** owner only; any other user sees Not found.

### `/history` (auth)

- **Role:** ops. **Purpose:** dense runs table + 480px run-detail drawer + Replay.
- **Primary actions:** filter (search, status, Zap), paginate (cursor), expand run → steps (input/output ≤100KB, latency), Replay FAILED/DLT (10/day/run), copy `zapRunId`.
- **UI states:** loading → rows | empty (with 90-day retention note) | error + retry. Statuses: `PENDING`, `RUNNING`, `SUCCESS`, `FAILED`, `SKIPPED`, `SUSPENDED` — icon + text, never color-only.
- **Security:** step input/output/error are plain text in `<pre>`, truncated, never HTML; status filter validated against enum; replay sends CSRF + `Idempotency-Key`; no auto-retry loops.
- **Access:** auth; rows scoped to own Zaps.

### `/analytics` (auth)

- **Purpose:** charts from `GET /dashboard`. Read-only. Same security notes as `/dashboard`.

### `/settings` (auth)

- **Role:** account. **Purpose:** profile, app connections (`#connections`), webhook secret rotation, data export/delete, sign out.
- **Primary actions:** update name, connect/disconnect Gmail/GitHub, rotate secret, Export my data, Delete account (confirm), Sign out.
- **UI states:** profile from `GET /user/` (never `userId=1`), per-action success/error toasts, destructive actions behind confirm dialogs; `REAUTH_REQUIRED` opens the re-auth dialog.
- **Security:** Delete account = confirm + typed `DELETE` + re-auth if backend asks; export downloads to a revoked Blob URL; connection tokens never present client-side; Sign out via POST.
- **Access:** auth.

## Security Headers by Route Class

| Class | Routes | Notes |
|---|---|---|
| Public static | `/` | CSP, HSTS, nosniff, frame-ancestors none; cacheable |
| Auth pages | `/login`, `/signup`, `/forgot` | + `no-store` |
| Token pages | `/reset`, `/auth/callback` | + `no-store`, `Referrer-Policy: no-referrer` |
| App pages | `/dashboard`, `/analytics`, `/history`, `/settings`, `/zap/*` | + `no-store`; server guard before render |

Full header list and CSP: `requirements.md` §5.3, §5.4, §5.8.

## Gates

- Every route above has: auth gate implemented server-side, cache policy applied, loading/empty/error states, and a Playwright test for its redirect behavior.
- `Pricing`, `Templates`, workspace switcher, plan meter absent from the DOM (`grep` and visual check).

---

**Status:** DRAFT v2
**Freeze rule:** Colors, type, spacing, radii, depth, and motion come from `design-system.md` v2 tokens only. No new visual language without a PRD update.
