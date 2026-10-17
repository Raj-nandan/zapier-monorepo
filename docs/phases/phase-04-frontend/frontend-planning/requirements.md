# Zapier-Monorepo Frontend — V1 Requirements

> **Document:** `docs/phase-04-frontend-planning/requirements.md`
> **Status:** DRAFT
> **Purpose:** Define exactly what the V1 frontend must provide and what is intentionally outside V1. Product truth lives in `docs/BRD.md`, `docs/PRD.md`, `docs/TRD.md`, `docs/DATAFLOW.md`. This file must not contradict them.

## 1. Frontend Goal

V1 demonstrates one coherent automation product:

```text
Signup/Login → Dashboard → Create automation (trigger → actions → Publish)
→ Fire webhook / schedule runs → History → Inspect failure → Retry
```

The frontend must feel like one product, not a collection of developer pages. It reuses the working legacy patterns (landing, auth split layout, dashboard table, zap-create builder) and wires every mock to real backend data.

## 2. The Three Experiences

### Experience A — Builder (create + edit)

The user picks 1 trigger (`webhook`, `schedule`, `github-poll`, `rss-poll`, `manual`) and N ordered actions (`email`, `slack`, `discord`, `http-request`, `delay`, `filter`), configures each step, maps fields via `{{step.output.*}}` dropdowns against 3 `test-trigger` samples, connects Gmail/GitHub apps where required, and publishes.

```text
Pick trigger → Configure (+ Test trigger samples) → Add action(s)
→ Map fields → Review → Publish
```

Edit (`/zap/[id]`) is the same builder bound to `GET /zap/:id`, saving with `If-Match: revision` (409 → reload prompt). In-flight runs stay pinned to the old revision — the UI must say so after Publish.

### Experience B — Workflow Detail (`/zap/[id]`)

One page answers: what does this automation do, is it on, and did it work lately. It shows trigger + ordered actions (read from backend, never static), active toggle (`PATCH /zap/:id/active`), webhook URL + secret (secret shown once, rotate button), recent runs for this Zap, and entry points to History detail and Replay.

### Experience C — History / Ops (`/history` + run detail)

The operations surface. Dense table of runs (`status`, Zap name, latency, error, time), filters (`search`, `status`, folder), cursor pagination, and a per-step drawer (`ZapRunStep[]`: input/output ≤100KB, latency) plus Replay (`POST /runs/:id/replay`) for FAILED/DLT runs. Runs are retained 90 days — the UI states this where history could look empty.

## 3. Must / Must-Not

Must:

- Wire every page to the contracts in `pages.md`; no static mock rows, dates, or user data.
- Send cookies on every API call (`credentials: include`); never store tokens in JavaScript.
- Treat backend as authority for auth state, Zap config, `ZapRun`/`ZapRunStep` status, and analytics (see §4).
- Show loading, empty, error states on every data screen (§6).
- Keep working legacy labels verbatim (`My automations`, `Create automation`, `Sign out` — see `content.md`).
- Support keyboard navigation and `prefers-reduced-motion` throughout.

Must-not:

- Never invent routes outside the frozen table in `pages.md`.
- Never rename working labels or reorder the proven signup → dashboard → create flow.
- Never display stack traces, SQL/DB errors, raw webhook secrets (except once at creation), connection tokens, or reset tokens.
- Never mark auth/payment-like state client-side; never fake a run as SUCCESS before the backend says so.
- No pricing or billing logic anywhere.

## 4. Backend-Is-Authority Rule

| Concern | Owner |
|---|---|
| Auth session (logged in / out) | Backend (`GET /api/v1/user/`, cookies) |
| Zap config, revision, active flag | Backend (`GET /zap/:id`, `If-Match`) |
| Run + step status, analytics counts | Backend (`/runs`, `/dashboard`) |
| Trigger samples for mapping | Backend (`POST /zap/test-trigger`) |
| Navigation, animation, optimistic toggle visuals (rolled back on error) | Frontend |

On any conflict (e.g. toggle shows ON but API returns 403), the backend value wins and the UI rolls back with a human message.

## 5. Responsive / Accessibility / Loading-Error Rules

- Dashboard and builder are mobile-first; history table is desktop-dense with horizontal scroll on small screens; every touch target ≥44px.
- Semantic HTML, visible focus rings, labeled controls, live regions for run-status changes and toast results, status never color-only (icon + text; see `design-system.md`).
- Every fetch shows skeleton → content | empty-state | error-with-retry. Errors are human sentences from `content.md`; backend codes are secondary and muted.

## 6. V1 Out of Scope

Per `PRD.md` §6 and `BRD.md` §4: team sharing/workspaces, Zap versioning UI beyond revision-conflict handling, branching/paths UI, usage billing/payments, mobile app, multi-region behavior, unrestricted theming (light theme tokens only), push notifications.

## 7. Definition of Done

Planning is sufficient when implementation can begin without inventing routes, flows, component behavior, responsive rules, tokens, or user-facing copy. Code is done when: all 8 frozen routes render real data, legacy bugs (`userId=1`, hardcoded dates, `localStorage` token) are gone, `grep -ri pricing apps/web` is empty, and every gate in `pages.md` and `user-flows.md` passes.

---

**Status:** DRAFT
**Freeze rule:** Colors, type, and spacing come from `design-system.md` tokens only. No new visual language without a PRD update.
