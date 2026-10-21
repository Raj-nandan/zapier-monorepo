# Zapier-Monorepo Frontend — Frozen Route Map (v3)

> **Document:** `docs/phase-04-frontend-planning/pages.md`
> **Status:** DRAFT v3 — aligned to `design-system.md` v3 and the Canva design file `Zapier-Monorepo Web App Design v2.html`
> **Purpose:** Freeze every V1 route. No route may be added, removed, or renamed without a PRD update. Data wiring per route is mandatory — static mocks from legacy (`zap/[id]`, `history`, `settings`) must be replaced with the listed backend calls.
> **v3 changes:** (1) the Canva design file is now the source of truth for the visual layer of every route, (2) per-route specs updated to the design's actual layout/copy/states, (3) `Design` column added to the route table, (4) the design-vs-scope reconciliation is now centralised in `requirements.md` §8, (5) run detail is an inline side panel, (6) builder canvas is a vertical step list, (7) mobile dashboard renders automations as cards.

---

## 0. Precedence

| Layer | Authority |
|---|---|
| Routes, access, auth gate, cache policy, backend calls, security | **This file** |
| Visual layout, component anatomy, tokens, copy, states | **The Canva design file**, transcribed in `design-system.md` v3 |
| Product scope (what exists at all) | `docs/PRD.md`, `docs/BRD.md` — see `requirements.md` §8 |

---

## Full Route Table

| Route | Access | Auth gate | Backend reads | Backend writes | Cache | Design |
|---|---|---|---|---|---|---|
| `/` | Public | None (CTA swaps client-side after session check) | None (static about content); optional `GET /api/v1/user/` for CTA | None | Static, shared | `02 Landing` |
| `/login` | Public-only (authed → `/dashboard`) | Redirect if session | `GET /api/v1/user/` (session check) | `POST /api/v1/user/signin`, `GET /api/v1/auth/google\|github` | `no-store` | `03 Log in` |
| `/signup` | Public-only (authed → `/dashboard`) | Redirect if session | Session check | `POST /api/v1/user/signup`, OAuth starts | `no-store` | `03 Log in` (mirrored) |
| `/forgot` | Public-only | Redirect if session | None | `POST /api/v1/user/forgot` | `no-store` | `03 Log in` (left column only) |
| `/reset` | Public (token required) | None; invalid/missing token → expired copy | None | `POST /api/v1/user/reset` | `no-store`, `Referrer-Policy: no-referrer` | `03 Log in` (left column only) |
| `/auth/callback` | Public (error display only) | None | None | None (cookies already set by backend redirect) | `no-store`, `no-referrer` | — |
| `/dashboard` | Auth | Server guard → 401 `/login?next=/dashboard` | `GET /api/v1/dashboard?window=7d\|30d\|90d`, `GET /api/v1/zap?search&folderId&active&cursor&limit` | `PATCH /api/v1/zap/:id/active` | `no-store` | `04 Dashboard` |
| `/zap/create` | Auth | Server guard | `GET /api/v1/trigger/available`, `GET /api/v1/action/available`, `POST /api/v1/zap/test-trigger`, `GET /api/v1/connections` | `POST /api/v1/zap` | `no-store` | `06 Builder` |
| `/zap/[id]` | Auth, owner only | Server guard + ID pattern check; non-owner → Not found | `GET /api/v1/zap/:id`, `GET /api/v1/zap/:id/runs?cursor&limit≤100`, `POST /api/v1/zap/test-trigger`, `GET /api/v1/connections` | `PUT/PATCH /api/v1/zap/:id` (`If-Match`), `PATCH /:id/active`, `POST /zap/:id/secret/rotate`, `POST /zap/:id/test` | `no-store` | `06 Builder` (edit mode) |
| `/history` | Auth | Server guard | `GET /api/v1/runs?search&status&cursor&limit≤100`, `GET /api/v1/runs/:id` (steps), `GET /api/v1/zap/:id/runs?cursor&limit≤100` (when a single automation is selected) | `POST /api/v1/runs/:id/replay` | `no-store` | `05 Run history + detail` |
| `/analytics` | Auth | Server guard | `GET /api/v1/analytics?window=7d\|30d\|90d` (same payload as `/dashboard`, TRD §5.1 #5) | None | `no-store` | (no dedicated canvas; reuses the `04 Dashboard` chart card) |
| `/settings` | Auth | Server guard | `GET /api/v1/user/`, `GET /api/v1/connections` | `POST /api/v1/connections/:app` (start app OAuth), `DELETE /api/v1/connections/:id`, `POST /zap/:id/secret/rotate`, `GET /api/v1/user/export`, `DELETE /api/v1/user`, `POST /api/v1/user/logout` | `no-store` | (no dedicated canvas; reuses the `04 Dashboard` shell) |

PRD-required auth support routes (F-1, not new inventions): `/forgot`, `/reset?token=`, `/auth/callback`. Special framework files (`not-found`, `error`, `global-error`, `loading`) are not routes.

**Backend contract note:** `GET /api/v1/connections` (list of connected apps + display names) is implemented in `apps/api/src/routes/connections.ts` and mounted at `/api/v1/connections`, but it is **not documented in `TRD.md` §5** (which lists only `GET /connections/:app` and `DELETE /connections/:id`). `TRD.md` §5.1 needs a line for it — the frontend contract in this file does not change.

---

## Layout Groups (design-system v3 shells)

| Group | Routes | Shell |
|---|---|---|
| `(marketing)` | `/` | Marketing header 64px (logo, in-page anchors `How it works` / `FAQ`, `Log in`, `Create automation`), announcement bar, hero + dot grid, marquee, bento, how-it-works, metrics, FAQ, ink CTA band, footer. No sidebar. |
| `(auth)` | `/login`, `/signup`, `/forgot`, `/reset`, `/auth/callback` | Split layout ≈52/48 (form left on paper, product vignette right on sunken + dot grid, hidden <lg). `forgot`/`reset`/`callback` use the left column only with a centered icon chip. |
| `(app)` | `/dashboard`, `/analytics`, `/history`, `/settings`, `/zap/*` | Dashboard shell: sidebar 248px (collapses to a 64px rail <lg, sheet + bottom tab bar on mobile), top bar 56px (breadcrumb, ⌘K search, theme toggle, help). `/zap/create` and `/zap/[id]` use the builder shell (own top bar, library 260px, canvas, inspector 320px). |

The `(app)` layout performs the server-side session check (`GET /api/v1/user/`) once per request, **fails closed**, and passes the user object down. Children never re-derive auth from cookies, URL, or storage.

---

## Navigation Map (v3 — frozen)

### App sidebar (`/dashboard`, `/analytics`, `/settings`)

| Group | Item | Route | Notes |
|---|---|---|---|
| — | Account chip | — | Avatar + name + email + sign-out. **No workspace switcher, no plan/usage meter** (PRD scope). |
| Overview | Dashboard | `/dashboard` | Page H1 is `My automations`; the breadcrumb reads `<workspace> / Dashboard`. |
| Automations | Create automation | `/zap/create` | Also the primary `Create automation` button (⌘N). |
| Automations | History | `/history` | |
| Automations | Templates | — | **Excluded** — no route, no data source (PRD scope). |
| Account | Connections | `/settings#connections` | Nav item; the target is a **section of `/settings`**, not a route. |
| Account | Settings | `/settings` | |
| Account | Analytics | `/analytics` | **Added by V1 scope; the design canvas omits it.** |

### App sidebar (`/history`)

The design shows a **simplified flat variant** on history: logo + workspace name, then a flat nav list (Dashboard, Create automation, History, Connections, Settings) with the same 32px items and the same active treatment (`flame-50` bg + `flame-600` icon). No groups, no switcher, no meter. Same routes, different arrangement.

### Other navigation

| Item | Destination | Notes |
|---|---|---|
| Account menu → Sign out | `POST /api/v1/user/logout` | Never a link/GET. |
| Marketing: `How it works`, `FAQ` | `/#how`, `/#faq` | In-page anchors only. |
| Marketing hero secondary CTA `See a live run` | `/#runs` | In-page anchor to the run-log bento tile. |
| Marketing header `Product`, `Templates`, `Pricing`, `Docs` | — | **Excluded** — no routes (PRD scope). |
| Landing footer `Resources` / `Company` links | inert placeholders | No routes exist; render as non-navigating placeholders. |

**Full design-vs-scope reconciliation table:** `requirements.md` §8. That table is the single place where a design element is rejected; this file only records the resulting routes.

---

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

---

## Per-Route Spec

### `/` — Landing (public)

- **Role:** marketing. **Purpose:** explain the product and route to signup/dashboard.
- **Design:** `02 Landing` — sections in fixed order: announcement bar → header → hero → integration marquee → bento → how it works → metrics → FAQ → final CTA band → footer. Hero is a left-aligned two-column split: copy left, live workflow card right on a dot grid. Bento grid is 7/5 then 4/4/4. **No templates preview section.**
- **Primary actions:** `Create automation` (accent, one per view) → `/signup`, or `/dashboard` when logged in; `Log in` → `/login`.
- **UI states:** static content + session-aware CTA (default signup; swap after `GET /user/`; failures keep the signup default).
- **Security:** no third-party scripts; no personalized HTML cached; external links `rel="noopener noreferrer"`.
- **Access:** public; header shows Dashboard + Sign out when a session exists.
- **Data:** the metrics strip shows **real values only**; the design's bracketed placeholders must be replaced or the strip hidden. Integration chips use generic names, never third-party logos. The webhook URL in the hero card is rendered from the backend, not hardcoded.

### `/login`, `/signup` (public-only)

- **Role:** auth. **Purpose:** credential + OAuth entry using the design-system §5 split layout (form left, product vignette right).
- **Design:** `03 Log in` — left column on paper with the logo top-left, a 400px centred form column, and Privacy / Terms / Help footer links. Right column on sunken + dot grid with the headline `Every run, step by step.` and a product vignette card showing a **failed** run and its step timeline.
- **Primary actions:** email form (react-hook-form + Zod), `Google` button, `GitHub` button (both side by side, each with an explicit `aria-label`), `Forgot password?` (login only). Signup adds a name field + password strength bar (advisory only).
- **UI states:** idle → submitting (disabled, spinner) → success (cookie set, → `safeNext` or `/dashboard`) | generic error (no enumeration). OAuth failures show the provider message from the fixed allowlist.
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

- **Role:** home. **Purpose:** `My automations` — manage and monitor your workflows.
- **Design:** `04 Dashboard` — page header (H1 `My automations` + description left; `Create automation` primary with ⌘N right; the design's `Docs` secondary is excluded — no route) → 4 stat cards → `Runs per day` chart card (ink succeeded bars, `#DC2626` failed bars, 7d/30d/90d segmented tabs) → `Automations` table card (search + `View history`; columns Name / Steps / On / Last run / Status / actions) → right rail (`Needs attention`, `Getting started` with a mono `2 / 4` counter and a 6px progress bar).
- **Primary actions:** Create automation (→ `/zap/create`), folder filter, search, per-row enable/disable toggle (optimistic, rollback on error), open Zap, copy webhook URL.
- **UI states:** skeleton table → rows | empty (`No automations yet.` + Create CTA) | error + retry. Toggle rolls back if the backend rejects.
- **Security:** names/URLs rendered as text; `search` URL-encoded; active toggle sends CSRF header; no per-user data in shared cache.
- **Access:** auth; 401 → `/login`. Fixes legacy `userId=1` (uses `GET /user/`) and hardcoded dates (uses `createdAt`).

### `/zap/create` (auth)

- **Role:** builder. **Purpose:** trigger → configure (+ samples) → actions → map → Publish.
- **Design:** `06 Builder` — top bar (back, editable name, `Draft` badge, `Saved · 12:04`, `Test`, `Publish ⌘↵`) → step library 260px (search, `Triggers` / `Actions` groups) → dotted canvas with a **vertical** stack of 300px node cards connected by 1.5px vertical rules with a 22px `+` insert handle, plus a dashed `Add step` button and a bottom-left zoom cluster → inspector 320px (step-index chip, `Setup` / `Test` / `Settings` tabs, labelled fields, mono `{{ref}}` values, `Test step`).
- **Primary actions:** pick trigger, Test trigger (3 samples, no run), add/configure/remove actions, connect app when required, Publish.
- **UI states:** pristine → configuring → validating (Zod, `{{ref}}` check) → publishing → success (→ `/zap/[id]`, secret shown once in memory) | field error | rate-limit message (20/day).
- **Security:** `Publish` sends CSRF + `Idempotency-Key`; HTTP-request action URLs shown as text and validated `http(s)`; sample payloads rendered as text; secret handled per SEC-SECRET-1/2; unsaved draft held in memory only.
- **Access:** auth; unavailable slugs disabled with reason.

### `/zap/[id]` (auth, owner)

- **Role:** workflow detail. **Purpose:** what it does, is it on, did it work — fully from `GET /zap/:id` (legacy static mock deleted).
- **Design:** the **same builder shell** as `/zap/create`, bound to `GET /zap/:id`; the `Draft` badge reflects the published state, and the saved indicator shows the real save time.
- **Primary actions:** Edit + Publish changes (`If-Match`, 409 → reload prompt), active toggle, Test (synthetic run), copy webhook URL, rotate secret (confirm + possible re-auth), open recent run in History, Replay a failed run.
- **UI states:** loading → detail | `Not found.` (including cross-user IDs → same copy) | conflict notice | "Edited elsewhere" — in-flight runs use revision N…
- **Security:** `[id]` pattern-validated before any fetch; webhook secret never shown after creation/rotation; rotation shows the new secret once.
- **Access:** owner only; any other user sees Not found.

### `/history` (auth)

- **Role:** ops. **Purpose:** dense runs table + run-detail panel + Replay.
- **Design:** `05 Run history + detail` — simplified flat sidebar → breadcrumb top bar → page header (`Run history` + `Every run and its steps. Kept for 90 days.`) → filter row (`Search by run ID`, `Status` with a count chip, `All automations`, `Last 30 days`) → runs table (Run / Automation / Status / Took / Started) with the pagination footer (`1–25 of {total} · runs are kept for 90 days` — counts from the backend — plus Previous / Next) → **480px inline run-detail panel** on the right.
- **Run-detail panel anatomy:** header (automation name, `run_8f2a91 · started 12:04:01` mono, status badge, `Retry run` primary, `Copy ID` secondary) → step timeline (20px status icons on a 1px rail; step title + mono duration; the failed step expands to an error card with the human sentence, `Retry from this step` and `Check connection`; every step ends with a truncated mono code well). On narrow screens the panel becomes a full-screen sheet.
- **Primary actions:** filter (search, status, Zap), paginate (cursor), open run → steps, Replay FAILED/DLT (10/day/run), copy `zapRunId`.
- **Data:** the list is global across the user's Zaps — `GET /api/v1/runs?search&status&cursor&limit`. Selecting one automation in the `All automations` chip switches to `GET /api/v1/zap/:id/runs?cursor&limit`; the query state is shared with the builder's "recent runs" link (`/history?zap=:id`).
- **UI states:** loading → rows | empty (with the 90-day retention note) | error + retry. Statuses: `PENDING`, `RUNNING`, `SUCCESS`, `FAILED`, `SKIPPED`, `SUSPENDED` — icon + text, never color-only.
- **Security:** step input/output/error are plain text in `<pre>`, truncated, never HTML; status filter validated against the enum; replay sends CSRF + `Idempotency-Key`; no auto-retry loops.
- **Access:** auth; rows scoped to own Zaps.

### `/analytics` (auth)

- **Purpose:** charts from `GET /api/v1/analytics?window=7d|30d|90d` (same payload shape as `/dashboard`, TRD §5.1 #5). Read-only. Same security notes as `/dashboard`. No dedicated canvas in the design file — it reuses the `04 Dashboard` chart card.

### `/settings` (auth)

- **Role:** account. **Purpose:** profile, app connections (`#connections`), webhook secret rotation, data export/delete, sign out.
- **Design:** no dedicated canvas — it uses the `04 Dashboard` shell (sidebar, top bar, account chip).
- **Primary actions:** update name, connect/disconnect Gmail/GitHub, rotate secret, Export my data, Delete account (confirm), Sign out.
- **UI states:** profile from `GET /user/` (never `userId=1`), per-action success/error toasts, destructive actions behind confirm dialogs; `REAUTH_REQUIRED` opens the re-auth dialog.
- **Security:** Delete account = confirm + typed `DELETE` + re-auth if the backend asks; export downloads to a revoked Blob URL; connection tokens never present client-side; Sign out via POST.
- **Access:** auth.

---

## Security Headers by Route Class

| Class | Routes | Notes |
|---|---|---|
| Public static | `/` | CSP, HSTS, nosniff, frame-ancestors none; cacheable |
| Auth pages | `/login`, `/signup`, `/forgot` | + `no-store` |
| Token pages | `/reset`, `/auth/callback` | + `no-store`, `Referrer-Policy: no-referrer` |
| App pages | `/dashboard`, `/analytics`, `/history`, `/settings`, `/zap/*` | + `no-store`; server guard before render |

Full header list and CSP: `requirements.md` §5.3, §5.4, §5.8.

---

## Gates

- Every route above has: auth gate implemented server-side, cache policy applied, loading/empty/error states, and a Playwright test for its redirect behavior.
- `Pricing`, `Templates`, workspace switcher and plan/usage meter are absent from the DOM (`grep` + visual check) — see `requirements.md` §8.
- **Design-parity gate:** each route renders the layout, component anatomy, copy and states described in `design-system.md` v3 for its design canvas; visual diff against the design file is reviewed before sign-off.

---

**Status:** DRAFT v3
**Freeze rule:** Routes, access, cache and backend calls come from this file. Colors, type, spacing, radii, depth, motion, layout and copy come from `design-system.md` v3 (the Canva design file) only. No new visual language without a PRD update.
