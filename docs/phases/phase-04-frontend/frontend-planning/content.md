# Zapier-Monorepo Frontend — Content & Copy

> **Document:** `docs/phase-04-frontend-planning/content.md`
> **Status:** DRAFT v3 — aligned to `design-system.md` v3 and the Canva design file `Zapier-Monorepo Web App Design v2.html`
> **Purpose:** Exact user-facing words for V1. Copy below is final — implementation copies it verbatim. Never show stack traces, SQL/DB errors, secrets (except once), tokens, or raw backend codes as primary text.
> **v3 changes:** (1) screen copy now **transcribes the design file** where it shows literal text, (2) brand is `Zapflow`, (3) the legacy `Join millions worldwide…` claim is resolved, (4) builder/history/dashboard copy matches the drawn canvases, (5) §10 lists copy that must never ship.

## 1. Navigation & Actions (verbatim)

- Brand wordmark (logo + footer + auth pages): `Zapflow`. `Zapier-Monorepo` is a technical/repo name and **never appears in the UI**.
- Footer tagline: `Automations you can see through, step by step.`
- Dashboard heading (H1): `My automations` / sub: `How your automations performed over the last 30 days.` Sidebar item label: `Dashboard`.
- Primary CTA everywhere: `Create automation` (replaces the design's `Start free` and `New automation`). Publish button: `Publish`. Session end: `Sign out`.
- Builder verbs: `Choose a trigger`, `Test trigger`, `Add action`, `Map fields`, `Publish`. History verbs: `Retry run`, `Copy ID`, `Retry from this step`, `Check connection`, `View step`.
- Sidebar (dashboard, grouped): **Overview** → `Dashboard`; **Automations** → `Create automation`, `History`; **Account** → `Analytics`, `Connections`, `Settings`.
- Sidebar (history, flat): `Dashboard`, `Create automation`, `History`, `Connections`, `Settings`.
- Mobile tab bar: `Dashboard`, `Create automation`, `History`, `Settings`.
- Account chip: user name + email + `Sign out` icon button. No workspace switcher, no plan label, no usage meter.
- Marketing header: `How it works`, `FAQ`, `Log in`, `Create automation`. (No `Pricing`, `Templates`, `Docs`, `Product` in V1.)
- Never rename: `Create automation`, `Publish`, `Sign out`, `My automations`.

## 2. Marketing / Landing Copy (design `02 Landing`)

- Optional announcement bar (static sentence, **no external link**, hidden by default): `New: run history now keeps every step for 90 days.`
- Hero H1 (two lines): `Automate the busywork.` / `Keep every run in sight.`
- Hero subcopy: `Connect your apps, publish a workflow in minutes, and see each step succeed or fail in plain language.`
- Hero CTAs: `Create automation` (primary accent; design label `Start free` replaced) / `See a live run` (secondary, in-page anchor to the run-log bento tile).
- Reassurance chip: `90-day run history`. (`Free to start` and `No card required` are **dropped** — plan/pricing implications, PRD §5.)
- Hero workflow card (illustrative): automation `New order alert`, steps `Catch webhook` → `Filter` → `Send email`, run line `Run #1284 — just now`, status `Running`, webhook URL **from the backend**, copy button with a `Copied` toast. Labelled as an example; no customer data; the run number is a sample.
- Integration marquee title: `Works with the tools you already use`. Chips use generic app names only (Email, Sheets, Chat, Forms, Calendar, Storage, Tickets, Database). Never third-party logos in V1.
- Bento section header: `Everything a run needs, in one place` / `Build, test, publish, and observe without leaving the dashboard.`
- Bento tiles (title / sentence):
  - `Build visually` / `Stack a trigger and steps on a canvas. Order follows the list, not where you drag.` — step list shown: `Catch webhook`, `Filter`, `Send email`.
  - `Every step, logged` / `Inputs, outputs and timings, searchable for 90 days.` — log lines: `12:04:01 trigger 200 12ms`, `12:04:01 filter pass 3ms`, `12:04:02 email sent 214ms`, `12:04:02 sheet running.`
  - `Switch on, switch off` / `Toggle instantly. If it fails, it rolls back and tells you why.` — sample card: `Weekly report digest`, `Active — 97% success`.
  - `Plain-language errors` / `No codes, no traces. Just what happened and what to do.` — sample: `We couldn't reach your CRM.` + `Retry`.
  - `Test before you publish` / `Fire a sample and watch every step answer back.` — buttons `Test`, `Publish ⌘↵`.
- How it works: heading `How it works` / sub `Live in three steps`. Steps:
  - `Pick a trigger` / `Start from a webhook, a schedule, or an app event.`
  - `Add your actions` / `Send email, post to chat, call an HTTP endpoint, delay or filter.`
  - `Publish and watch` / `Turn it on. Every run shows up in History with its steps.`
- Metrics strip: shown only with real backend/BRD numbers; otherwise omitted (no placeholder numbers in production).
- FAQ: heading `FAQ` / sub `Questions, answered`. Items (no plan/pricing questions):
  - `What counts as a run?` / `One trigger firing and all of its steps. Each step is logged separately.`
  - `Can I retry a failed run?` / `Yes. Open the run, find the failed step, and choose Retry.`
  - `How long is history kept?` / `Runs and step details are kept for 90 days.`
  - `Is my webhook secret safe?` / `It is shown once when you create or rotate it. Copy it then; we cannot show it again.`
- Final CTA band: `Ship your first automation today` / `Pick a trigger, add a step, publish. Your first run can land before lunch.` / `Create automation` + `Log in`.
- Footer: `Zapflow` · `Automations you can see through, step by step.` · three columns `Product`, `Resources`, `Company` (no pricing links; `Resources`/`Company` entries are inert placeholders) · `Privacy`, `Terms` (placeholders pending legal) · `© Zapflow. All rights reserved.` · status line `All systems normal` only if driven by a real status source, otherwise omitted.

## 3. Auth Copy (design `03 Log in`)

- Left column (paper, form): logo `Zapflow` → heading → sub → OAuth buttons → divider → fields → submit → helper link → `Privacy` / `Terms` / `Help`.
- Login heading: `Welcome back` / sub `Log in to manage your automations.`
- Signup heading: `Create your account` / sub `Publish a workflow in minutes.` (mirrors the design's login structure; derived from the design's landing language).
- Helper link (login): `New here? Create an account`. Helper link (signup): `Already have an account? Log in`.
- OAuth buttons (side by side, icon + name, each with an explicit `aria-label`): `Google`, `GitHub`. Divider: `or with email`.
- Field labels: `Name` (signup), `Email`, `Password`. Helper under password (signup): `At least 8 characters.` Strength labels (advisory, never blocks submit): `Weak`, `Okay`, `Strong`.
- Show/hide password aria-labels: `Show password` / `Hide password`.
- Forgot: link `Forgot password?`; page `Reset your password` + `Enter your email and we will send you a reset link.`; submit always → `If an account exists for that email, a reset link is on its way.`
- Reset: `Choose a new password` (≥8 chars); success → `Password updated. Please log in.` Expired/used/missing token → `This reset link is invalid or expired. Request a new one.`
- Generic failures: `Invalid credentials. Please try again.` / `Something went wrong. Please try again.` Signup conflict uses the generic copy (no `account already exists`). OAuth failure: `Google sign-in failed. Please try again.` / `GitHub sign-in failed. Please try again.`
- `/auth/callback` fixed messages by error key: `access_denied` → `Sign-in was cancelled.` · `provider_error` → `{Provider} sign-in failed. Please try again.` · `state_mismatch` → `Sign-in could not be verified. Please try again.` · anything else → `Something went wrong. Please try again.` Link: `Back to log in`.
- Sign out: `Sign out` → `You have been signed out.`
- Right column (sunken + dot grid, product vignette, hidden <lg) — static product copy, no user data:
  - Headline: `Every run, step by step.` / sub `See what ran, what failed, and what to do next.`
  - Vignette card: `Lead to CRM — Run #1281`, badge `Failed`, step lines, error line `We couldn't reach your CRM. Retry from step 2.`
- **Resolved:** the legacy headline `Join millions worldwide who automate their work.` is **dropped** (unverifiable claim). `Every run, step by step.` is the product headline.

## 4. Session & Security Copy

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

## 5. Dashboard / Builder / History Copy

### Dashboard (design `04 Dashboard`)

- Page header: H1 `My automations` / sub `How your automations performed over the last 30 days.` / primary `Create automation` (⌘N). **No `Docs` button.**
- Stat cards: `Active automations`, `Runs — 30 days`, `Success rate`, `Failed runs` (deltas from backend data).
- Chart card: title `Runs per day`; legend `Succeeded`, `Failed`; range tabs `7d`, `30d`, `90d` (30d default).
- Automations card: title `Automations`; search placeholder `Search automations`; link `View history`; columns `Name`, `Steps`, `On`, `Last run`, `Status`.
- Empty (design card): `No automations yet` / `Create your first automation and its runs will show up here.` / CTA `Create automation`.
- Toggle off note: `Paused. Scheduled and polling triggers will skip this automation.` 409 conflict: `This automation changed elsewhere. Reload to get the latest revision.`
- Right rail: `Needs attention` (items like `{name} failed at step {n}. Review` / `{name} is suspended. Resume`) and `Getting started` (items derived from backend data: `Create your first automation`, `Publish an automation`, `Connect an app`, `Run a test`).

### Builder (design `06 Builder`)

- Top bar: name placeholder `Automation name`; badge `Draft`; saved indicator `Saved · {time}`; buttons `Test`, `Publish ⌘↵`.
- Step library: search placeholder `Search steps`; groups `Triggers`, `Actions`; items `Webhook`, `Schedule`, `App event` / `Send email`, `Add spreadsheet row`, `Post message`, `Filter`, `Delay`.
- Canvas: `Add step`; zoom cluster `100%`.
- Inspector: tabs `Setup`, `Test`, `Settings`; field labels `Spreadsheet`, `Worksheet`, `Customer`; helper `Insert data from an earlier step.`; button `Test step`.
- Publish success: `Automation published.` + `Webhook URL ready — secret shown once: copy it now.` Rate limit: `You have reached today's creation limit (20). Try again tomorrow.`
- Test trigger: `Fetch samples` → `3 sample items loaded. No run was created.` No samples: `No sample data found. Adjust the configuration and try again.`

### History (design `05 Run history + detail`)

- Page header: H1 `Run history` / sub `Every run and its steps. Kept for 90 days.`
- Filters: search placeholder `Search by run ID`; chips `Status {n}`, `All automations`, `Last 30 days`.
- Table columns: `Run`, `Automation`, `Status`, `Took`, `Started`.
- Pagination: `1–25 of 1,284 · runs are kept for 90 days` (counts from the backend), `Previous`, `Next`.
- Run-detail panel: `{automation name}`; mono `run_8f2a91 · started 12:04:01`; status badge; `Retry run`; `Copy ID`; failed step → backend `error` text + `Retry from this step` + `Check connection`; each step ends with a mono code well (step input/output, truncated).
- Empty: `No runs yet. Fire the webhook or run a test — runs appear here. History is kept for 90 days.`
- Replay: `Replaying…` → `Replay started as run {id}.` Limit: `Replay limit reached for this run (10 per day).`
- Statuses read `Pending / Running / Success / Failed / Skipped / Suspended (waiting to resume)`.

## 6. Errors / Empty / Loading

- Error card (design): title `We couldn't load your runs` / body `Check your connection and try again.` / actions `Retry` and `Contact support`. Generic form: `Could not load {thing}. Check your connection and Retry.`
- Loading: `Loading automations…`, `Loading runs…`, `Testing trigger…`, `Publishing…`, `Signing in…`.
- Empty card (design): icon chip + title + one sentence + a single primary CTA (see §5 for the drawn examples).
- 401 → redirect to login with `Please log in to continue.` 403/404 → `Not found.` (same copy for cross-user IDs). 429 → `Too many requests. Please wait and try again.`
- Inline field errors: `Enter a valid email address.` · `Password must be at least 8 characters.` · `Name is required.` · `Enter a valid URL starting with http:// or https://.`
- Toast (design): `Copied`.
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

- Screen copy comes from this file. Where the design file shows literal text, this file **transcribes it verbatim** — the design wins on copy; the PRD wins on scope (see `requirements.md` §8).
- Brand: `Zapflow` everywhere user-facing. `Zapier-Monorepo` never appears in the UI.
- `Create automation` (not "Create Zap", "Start free", "New automation", "Create"), `Publish` (not "Save/Deploy"), `Sign out` (not "Log out/Logout"), `My automations` (dashboard title), sentence case everywhere, periods only on full sentences, buttons use verbs.
- Dates render from backend `createdAt` in the user locale with absolute title tooltip — never hardcoded. Counts in stat cards, pagination and charts come from the backend — never hardcoded.
- Security messages are generic and consistent; they never reveal whether an account, email, or resource exists.
- All copy is rendered as text (no HTML in strings); `{placeholders}` are filled with escaped values.

## 9. Security of Copy

- Copy files contain no secrets, internal hostnames, or example credentials.
- Any user-supplied value interpolated into copy (`{name}`, `{id}`, `{App}`) is escaped by the framework and truncated with ellipsis plus full value in a title tooltip.
- Error messages never include stack traces, SQL, file paths, or backend codes as primary text; codes may appear muted in a copyable “Details” row only for 5xx and never contain request data.

## 10. Copy That Must Never Ship

| String | Reason |
|---|---|
| `Pricing`, `Free plan`, `Start free`, `Free to start`, `No card required` | Pricing/billing and plan language — PRD §5, BRD |
| `Templates` | No route, no data source — PRD §5 |
| `Docs`, `Product` (as header links) | No route — `pages.md` |
| `New automation` | Replaced by `Create automation` |
| `Join millions worldwide who automate their work.` | Unverifiable claim — dropped in favour of `Every run, step by step.` |
| `Acme Ops`, `Maya Rao`, `maya@acme.com` | Design sample data — never rendered |
| `hooks.zapflow.app`, `run_8f2a91`, `1,284 / 2,000` | Design sample data / hardcoded URLs — the webhook URL comes from the backend |

Gate: `grep -ri "pricing\|free plan\|templates\|acme ops\|maya rao\|hooks.zapflow.app" apps/web` returns nothing.

---

**Status:** DRAFT v3
**Freeze rule:** Screen copy comes from this file; where the design file shows literal text, this file transcribes it and the design wins. Scope comes from `requirements.md` §8. No new visual language without a PR to `design-system.md`.
