# Zapier-Monorepo Frontend — Frozen Route Map

> **Document:** `docs/phase-04-frontend-planning/pages.md`
> **Status:** DRAFT
> **Purpose:** Freeze every V1 route. No route may be added, removed, or renamed without a PRD update. Data wiring per route is mandatory — static mocks from legacy (`zap/[id]`, `history`, `settings`) must be replaced with the listed backend calls.

## Full Route Table

| Route | Access | Backend reads | Backend writes |
|---|---|---|---|
| `/` | Public | None (static about content) | None |
| `/login` | Public (redirects to `/dashboard` if session) | `GET /api/v1/user/` (session check) | `POST /api/v1/user/signin`, `GET /api/v1/auth/google\|github` |
| `/signup` | Public (redirects if session) | Session check | `POST /api/v1/user/signup`, OAuth starts |
| `/dashboard` | Auth | `GET /api/v1/dashboard`, `GET /api/v1/zap?search&folderId&active` | `PATCH /api/v1/zap/:id/active` |
| `/zap/create` | Auth | `GET /api/v1/trigger/available`, `GET /api/v1/action/available`, `POST /api/v1/zap/test-trigger`, `GET /api/v1/connections` | `POST /api/v1/zap` |
| `/zap/[id]` | Auth, owner only | `GET /api/v1/zap/:id`, `GET /api/v1/zap/:id/runs?limit=5`, `POST /api/v1/zap/test-trigger` | `PUT/PATCH /api/v1/zap/:id` (`If-Match`), `PATCH /:id/active`, `POST /zap/:id/secret/rotate`, `POST /zap/:id/test` |
| `/history` | Auth | `GET /api/v1/zap/:id/runs?search&status&cursor&limit`, `GET /api/v1/runs/:id` (steps) | `POST /api/v1/runs/:id/replay` |
| `/analytics` | Auth | `GET /api/v1/dashboard` (charts data) | None |
| `/settings` | Auth | `GET /api/v1/user/`, `GET /api/v1/connections` | `POST /zap/:id/secret/rotate`, connections connect/disconnect, `GET /api/v1/user/export`, `DELETE /api/v1/user`, `POST /api/v1/user/logout` |

PRD-required auth support routes (F-1, not new inventions): `/forgot` (`POST /user/forgot`), `/reset?token=` (`POST /user/reset`), `/auth/callback` (error display only; session arrives via `httpOnly` cookies).

## Per-Route Spec

### `/` — Landing (public)

- **Role:** marketing. **Purpose:** explain the project (about only) and route to signup/dashboard.
- **Primary actions:** “Create automation” CTA (→ `/signup` or `/dashboard` when logged in), “Log in”.
- **UI states:** static content + session-aware CTA. No pricing section (legacy `PricingPreviewSection` is dropped per PRD).
- **Access:** public; header shows Dashboard + Sign out when a session exists.

### `/login`, `/signup` (public)

- **Role:** auth. **Purpose:** credential + OAuth entry, reusing the legacy split layout (“Join millions worldwide who automate their work.” + checklist panel).
- **Primary actions:** email form (react-hook-form + Zod), Google button, GitHub button, “Forgot password?” (login only).
- **UI states:** idle → submitting (disabled) → success (cookie set, → `/dashboard`) | generic error (no enumeration). OAuth failures show the provider message as text.
- **Access:** logged-in visits redirect to `/dashboard`.

### `/dashboard` (auth)

- **Role:** home. **Purpose:** “My automations — Manage and monitor your workflows”: folders, search, active toggle, table, analytics cards.
- **Primary actions:** Create automation (→ `/zap/create`), folder filter, search, per-row enable/disable toggle (optimistic, rollback on error), open Zap, copy webhook URL.
- **UI states:** skeleton table → rows | empty (“No automations yet” + Create CTA) | error + retry. Toggle rolls back if the backend rejects.
- **Access:** auth; 401 → `/login`. Fixes legacy `userId=1` (uses `GET /user/`) and hardcoded dates (uses `createdAt`).

### `/zap/create` (auth)

- **Role:** builder. **Purpose:** trigger → configure (+ samples) → actions → map → Publish.
- **Primary actions:** pick trigger, Test trigger (3 samples, no run), add/configure/remove actions, connect app when required, Publish.
- **UI states:** pristine → configuring → validating (Zod, `{{ref}}` check) → publishing → success (→ `/zap/[id]`, secret shown once) | field error | 409 n/a (new Zap) | rate-limit message (20/day).
- **Access:** auth; unavailable slugs disabled with reason.

### `/zap/[id]` (auth, owner)

- **Role:** workflow detail. **Purpose:** what it does, is it on, did it work — fully from `GET /zap/:id` (legacy static mock deleted).
- **Primary actions:** Edit + Publish changes (`If-Match`, 409 → reload prompt), active toggle, Test (synthetic run), copy webhook URL, rotate secret, open recent run in History, Replay a failed run.
- **UI states:** loading → detail | 404 (including cross-user IDs — same copy) | conflict notice | “Edited elsewhere — in-flight runs use revision N”.
- **Access:** owner only; any other user sees 404.

### `/history` (auth)

- **Role:** ops. **Purpose:** dense runs table + step drawer + Replay (replaces legacy mock).
- **Primary actions:** filter (search, status, Zap), paginate (cursor), expand run → steps (input/output ≤100KB, latency), Replay FAILED/DLT (10/day/run), copy `zapRunId`.
- **UI states:** loading → rows | empty (with 90-day retention note) | error + retry. Statuses: `PENDING`, `RUNNING`, `SUCCESS`, `FAILED`, `SKIPPED`, `SUSPENDED` — icon + text, never color-only.
- **Access:** auth; rows scoped to own Zaps.

### `/settings` (auth)

- **Role:** account. **Purpose:** profile, app connections, webhook secret rotation, data export/delete, log out (replaces legacy mock).
- **Primary actions:** update name, connect/disconnect Gmail/GitHub, rotate secret, Export my data, Delete account (confirm), Sign out.
- **UI states:** profile from `GET /user/` (never `userId=1`), per-action success/error toasts, destructive actions behind confirm dialogs.
- **Access:** auth.

---

**Status:** DRAFT
**Freeze rule:** Colors, type, and spacing come from `design-system.md` tokens only. No new visual language without a PRD update.
