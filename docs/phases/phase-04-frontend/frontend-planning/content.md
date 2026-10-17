# Zapier-Monorepo Frontend — Content & Copy

> **Document:** `docs/phase-04-frontend-planning/content.md`
> **Status:** DRAFT
> **Purpose:** Exact user-facing words for V1. Copy below is final — implementation copies it verbatim. Never show stack traces, SQL/DB errors, secrets (except once), tokens, or raw backend codes as primary text.

## 1. Navigation & Actions (verbatim)

- Product title: `Automate — Workflow automation`. Tagline: `Connect your apps and automate workflows. No code required.`
- Dashboard heading: `My automations` / sub: `Manage and monitor your workflows`.
- Primary CTA everywhere: `Create automation`. Publish step button: `Publish`. Session end: `Sign out`.
- Builder verbs: `Choose a trigger`, `Test trigger`, `Add action`, `Map fields`, `Publish`. History verbs: `Retry` (replay), `View steps`, `Copy run ID`.
- Never rename: `Create automation`, `Publish`, `Sign out`, `My automations`.

## 2. Auth Copy

- Login headline (legacy, kept): `Join millions worldwide who automate their work.`
- Signup: `Create your account` / `Already have an account? Log in`. Login: `Welcome back` / `New here? Create an account`.
- Forgot: link `Forgot password?`; page `Reset your password` + `Enter your email and we will send you a reset link.`; submit always → `If an account exists for that email, a reset link is on its way.`
- Reset: `Choose a new password` (≥8 chars); success → `Password updated. Please log in.` Expired/used token → `This reset link is invalid or expired. Request a new one.`
- Generic failures: `Invalid credentials. Please try again.` / `Something went wrong. Please try again.` OAuth failure: `Google sign-in failed. Please try again.` (provider-named variant for GitHub).
- Sign out: `Sign out` → `You have been signed out.`

## 3. Dashboard / Create / History Copy

- Dashboard empty: `No automations yet.` + `Create your first automation to get started.` Toggle off note: `Paused. Scheduled and polling triggers will skip this automation.` 409 conflict: `This automation changed elsewhere. Reload to get the latest revision.`
- Publish success: `Automation published.` + `Webhook URL ready — secret shown once: copy it now.` Rate limit: `You have reached today's creation limit (20). Try again tomorrow.`
- Test trigger: `Fetch samples` → `3 sample items loaded. No run was created.` No samples: `No sample data found. Adjust the configuration and try again.`
- History empty: `No runs yet. Fire the webhook or run a test — runs appear here. History is kept for 90 days.` Row error: show backend `error` string only. Replay: `Replaying…` → `Replay started as run {id}.` Limit: `Replay limit reached for this run (10 per day).`
- Step drawer: `Input`, `Output (truncated at 100 KB)`, `Error`, `{n} ms`. Statuses read `Pending / Running / Success / Failed / Skipped / Suspended (waiting to resume)`.

## 4. Errors / Empty / Loading

- Loading: `Loading automations…`, `Loading runs…`, `Testing trigger…`, `Publishing…`.
- Empty: `Nothing here yet.` + relevant CTA. Errors: `Could not load {thing}. Check your connection and Retry.` 401 → redirect login with `Please log in to continue.` 403/404 → `Not found.` (same copy for cross-user IDs). 429 → `Too many requests. Please wait and try again.`
- Never: stack traces, `500` dumps, `Prisma`/`SQL` text, secrets, tokens, raw `zapRunId` as headline (copyable secondary only).

## 5. Backend-Code → Human Map

| Backend | Human |
|---|---|
| `PENDING / RUNNING` | `Waiting / Running` (spinner, live region) |
| `SUCCESS` | `Success` |
| `FAILED` | `Failed — view steps` |
| `SKIPPED` | `Skipped by filter` |
| `SUSPENDED` | `Paused for delay — resumes automatically` |
| `401` | `Please log in to continue.` |
| `403 / 404` | `Not found.` |
| `409 revision` | `Changed elsewhere. Reload.` |
| `413` | `Payload too large (max 1 MB).` |
| `429` | `Too many requests. Please wait and try again.` |
| `Idempotency-Key reuse` | Original run returned, no duplicate created (silent) |

## 6. Consistency Rules

`Create automation` (not “Create Zap”), `Publish` (not “Save/Deploy”), `Sign out` (not “Log out/Logout”), `My automations` (dashboard title), sentence case everywhere, periods only on full sentences, buttons use verbs. Dates render from backend `createdAt` in the user locale with absolute title tooltip — never hardcoded.

---

**Status:** DRAFT
**Freeze rule:** Colors, type, and spacing come from `design-system.md` tokens only. No new visual language without a PRD update.
