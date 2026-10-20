# Zapier-Monorepo Frontend — Content & Copy

> **Document:** `docs/phase-04-frontend-planning/content.md`
> **Status:** DRAFT v2 — aligned to `design-system.md` v2, security-hardened
> **Purpose:** Exact user-facing words for V1. Copy below is final — implementation copies it verbatim. Never show stack traces, SQL/DB errors, secrets (except once), tokens, or raw backend codes as primary text. v2 adds marketing copy for the new landing, security/session copy, and the v2-to-V1 label reconciliation.

## 1. Navigation & Actions (verbatim)

- Product title: `Automate — Workflow automation`. Tagline: `Connect your apps and automate workflows. No code required.`
- Dashboard heading (H1): `My automations` / sub: `Manage and monitor your workflows`. Sidebar item label: `Dashboard`.
- Primary CTA everywhere: `Create automation` (replaces v2 mock labels “Start free” and “New automation”). Publish step button: `Publish`. Session end: `Sign out`.
- Builder verbs: `Choose a trigger`, `Test trigger`, `Add action`, `Map fields`, `Publish`. History verbs: `Retry` (replay), `View steps`, `Copy run ID`.
- Sidebar: `Dashboard`, `Create automation`, `History`, `Analytics`, `Connections` (→ settings section), `Settings`. Account menu: `Settings`, `Sign out`.
- Marketing header: `How it works`, `FAQ`, `Log in`, `Create automation`. (No `Pricing`, `Templates`, `Docs`, `Product` in V1.)
- Never rename: `Create automation`, `Publish`, `Sign out`, `My automations`.

## 2. Marketing / Landing Copy (v2)

- Eyebrow: `Workflow automation`
- Hero headline: `Automate the busywork. Keep every run in sight.`
- Hero subcopy: `Connect your apps and automate workflows. No code required.`
- Hero CTAs: `Create automation` (primary accent) / `See how it works` (secondary, anchors to `#how`).
- Reassurance points: `No code required` · `Every run logged step by step` · `History kept for 90 days`
- Workflow card (illustrative): automation `New order alert`, steps `Catch webhook` → `Send email` → `Add spreadsheet row`, run label `Run in progress`. Labelled as an example, no real customer data.
- Integration marquee title: `Works with the tools you already use`. Chips use generic app names only (Email, Sheets, Chat, Forms, Calendar, Storage, Tickets, Database). Never third-party logos in V1.
- Bento tiles (title / sentence):
  - `Build visually` / `Stack a trigger and actions on a canvas. Order follows the list, not where you drag.`
  - `Every step, logged` / `Inputs, outputs and timings for each run, kept for 90 days.`
  - `Switch on, switch off` / `Toggle an automation instantly. If it fails, it rolls back and tells you why.`
  - `Plain-language errors` / `No codes, no traces. Just what happened and what to do next.`
  - `Test before you publish` / `Fetch sample data and test your trigger without creating a run.`
- How it works: `Pick a trigger` / `Start from a webhook, a schedule, or an app event.` · `Add your actions` / `Send email, post to chat, call an HTTP endpoint, delay or filter.` · `Publish and watch` / `Turn it on. Every run shows up in History with its steps.`
- Metrics strip: shown only with real backend/BRD numbers; otherwise omitted (no placeholder numbers in production).
- FAQ (4 items):
  - `What counts as a run?` / `One trigger firing and all of its steps. Each step is logged separately.`
  - `Can I retry a failed run?` / `Yes. Open the run, find the failed step, and choose Retry.`
  - `How long is history kept?` / `Runs and step details are kept for 90 days.`
  - `Is my webhook secret safe?` / `It is shown once when you create or rotate it. Copy it then; we cannot show it again.`
- Final CTA band: `Create your first automation` / `Pick a trigger, add an action, publish.` / `Create automation` + `Log in`.
- Footer: `Automations you can see through, step by step.` · links `Privacy`, `Terms` (placeholders pending legal) · status line `All systems normal` only if driven by a real status source, otherwise omitted.
- Optional announcement bar: static sentence, no external link; hidden by default.

## 3. Auth Copy

- Login panel headline (legacy, kept): `Join millions worldwide who automate their work.` **Flag:** unverifiable claim — confirm with BRD/legal or replace with `Every run, step by step.` (v2 vignette line) before launch.
- Signup: `Create your account` / `Already have an account? Log in`. Login: `Welcome back` / `New here? Create an account`.
- Field labels: `Name`, `Email`, `Password`. Helper under password (signup): `At least 8 characters.` Strength labels (advisory): `Weak`, `Okay`, `Strong`.
- Show/hide password aria-labels: `Show password` / `Hide password`.
- OAuth buttons: `Continue with Google`, `Continue with GitHub`. Divider: `or with email`.
- Forgot: link `Forgot password?`; page `Reset your password` + `Enter your email and we will send you a reset link.`; submit always → `If an account exists for that email, a reset link is on its way.`
- Reset: `Choose a new password` (≥8 chars); success → `Password updated. Please log in.` Expired/used/missing token → `This reset link is invalid or expired. Request a new one.`
- Generic failures: `Invalid credentials. Please try again.` / `Something went wrong. Please try again.` Signup conflict uses the generic copy (no `account already exists`). OAuth failure: `Google sign-in failed. Please try again.` (provider-named variant for GitHub).
- `/auth/callback` fixed messages by error key: `access_denied` → `Sign-in was cancelled.` · `provider_error` → `{Provider} sign-in failed. Please try again.` · `state_mismatch` → `Sign-in could not be verified. Please try again.` · anything else → `Something went wrong. Please try again.` Link: `Back to log in`.
- Sign out: `Sign out` → `You have been signed out.`

## 4. Session & Security Copy (v2)

- Session required (401 redirect): `Please log in to continue.`
- Session expired mid-use: `Your session ended. Please log in to continue.`
- Other tab signed out: `You were signed out in another tab.`
- Re-auth dialog: title `Confirm it’s you` / body `For your security, enter your password to continue.` / actions `Confirm` and `Cancel`; OAuth-only accounts: `Sign in with {Provider} again to continue.` Failure: `Invalid credentials. Please try again.`
- Rate limited (with countdown): `Too many requests. Please wait and try again.` + `Try again in {n}s.`
- CSRF/validation reject (403 not-authorization): `Your session changed. Reload the page and try again.`
- Secret dialog: title `Webhook secret` / body `Copy this secret now. For security it will not be shown again.` / actions `Reveal`, `Copy`, `Done`. Toast: `Copied`. Close confirm if not copied: `You have not copied the secret yet. Close anyway?`
- Rotate secret confirm: title `Rotate webhook secret?` / body `The current secret stops working immediately. Update anything that signs requests to this automation.` / actions `Rotate secret` (destructive), `Cancel`. Success: `Secret rotated. Copy the new secret now.`
- Disconnect app confirm: `Disconnect {App}? Automations that use it will stop working until you reconnect.`
- Delete account: title `Delete your account?` / body `This permanently deletes your automations and run history. This cannot be undone.` / instruction `Type DELETE to confirm.` / actions `Delete account` (destructive, disabled until typed), `Cancel`. Success: `Your account has been deleted.`
- Export: `Export my data` → `Export ready.`
- Leave builder with unsaved changes: `Leave without publishing? Your changes will be lost.`
- Offline: `You are offline. Reconnect and Retry.`
- Not found (any invalid/forbidden ID): `Not found.` + link `Back to My automations`.

## 5. Dashboard / Create / History Copy

- Dashboard empty: `No automations yet.` + `Create your first automation to get started.` Toggle off note: `Paused. Scheduled and polling triggers will skip this automation.` 409 conflict: `This automation changed elsewhere. Reload to get the latest revision.`
- Stat card labels: `Active automations`, `Runs (30 days)`, `Success rate`, `Failed runs`. Chart title: `Runs per day`; legend `Succeeded`, `Failed`; range tabs `7d`, `30d`, `90d`.
- Right rail: `Needs attention` (items like `{name} failed at step {n}. View steps` / `{name} is paused for a delay.`) and `Getting started` (items derived from backend data: `Create your first automation`, `Publish an automation`, `Connect an app`, `Run a test`).
- Publish success: `Automation published.` + `Webhook URL ready — secret shown once: copy it now.` Rate limit: `You have reached today's creation limit (20). Try again tomorrow.`
- Test trigger: `Fetch samples` → `3 sample items loaded. No run was created.` No samples: `No sample data found. Adjust the configuration and try again.`
- History empty: `No runs yet. Fire the webhook or run a test — runs appear here. History is kept for 90 days.` Row error: show backend `error` string only, as plain text. Replay: `Replaying…` → `Replay started as run {id}.` Limit: `Replay limit reached for this run (10 per day).`
- Run drawer: header `{automation name}` + `Run {id}` (mono, copyable); sections `Input`, `Output (truncated at 100 KB)`, `Error`, `{n} ms`. Failed step message: backend `error` text + `Retry from this step`. Statuses read `Pending / Running / Success / Failed / Skipped / Suspended (waiting to resume)`.
- Filters: `Status`, `All automations`, `Last 30 days`; pagination `Previous`, `Next`, summary `{from}–{to} of {total}`; footer note `Runs are kept for 90 days.`

## 6. Errors / Empty / Loading

- Loading: `Loading automations…`, `Loading runs…`, `Testing trigger…`, `Publishing…`, `Signing in…`.
- Empty: `Nothing here yet.` + relevant CTA. Errors: `Could not load {thing}. Check your connection and Retry.` 401 → redirect login with `Please log in to continue.` 403/404 → `Not found.` (same copy for cross-user IDs). 429 → `Too many requests. Please wait and try again.`
- Inline field errors: `Enter a valid email address.` · `Password must be at least 8 characters.` · `Name is required.` · `Enter a valid URL starting with http:// or https://.`
- Never: stack traces, `500` dumps, `Prisma`/`SQL` text, secrets, tokens, raw `zapRunId` as headline (copyable secondary only), echoed URL parameters, HTML from the backend.

## 7. Backend-Code → Human Map

| Backend | Human |
|---|---|
| `PENDING / RUNNING` | `Waiting / Running` (spinner, live region) |
| `SUCCESS` | `Success` |
| `FAILED` | `Failed — view steps` |
| `SKIPPED` | `Skipped by filter` |
| `SUSPENDED` | `Paused for delay — resumes automatically` |
| `401` | `Please log in to continue.` |
| `401 REAUTH_REQUIRED` | Re-auth dialog (§4) |
| `403 / 404` | `Not found.` |
| `403 CSRF` | `Your session changed. Reload the page and try again.` |
| `409 revision` | `Changed elsewhere. Reload.` |
| `413` | `Payload too large (max 1 MB).` |
| `429` | `Too many requests. Please wait and try again.` |
| `5xx / network` | `Something went wrong. Please try again.` |
| `Idempotency-Key reuse` | Original run returned, no duplicate created (silent) |

## 8. Consistency Rules

`Create automation` (not “Create Zap”, “Start free”, “New automation”), `Publish` (not “Save/Deploy”), `Sign out` (not “Log out/Logout”), `My automations` (dashboard title), sentence case everywhere, periods only on full sentences, buttons use verbs. Dates render from backend `createdAt` in the user locale with absolute title tooltip — never hardcoded. Security messages are generic and consistent; they never reveal whether an account, email, or resource exists. All copy is rendered as text (no HTML in strings); `{placeholders}` are filled with escaped values.

## 9. Security of Copy

- Copy files contain no secrets, internal hostnames, or example credentials.
- Any user-supplied value interpolated into copy (`{name}`, `{id}`, `{App}`) is escaped by the framework and truncated with ellipsis plus full value in a title tooltip.
- Error messages never include stack traces, SQL, file paths, or backend codes as primary text; codes may appear muted in a copyable “Details” row only for 5xx and never contain request data.

---

**Status:** DRAFT v2
**Freeze rule:** Colors, type, spacing, radii, depth, and motion come from `design-system.md` v2 tokens only. No new visual language without a PRD update.
