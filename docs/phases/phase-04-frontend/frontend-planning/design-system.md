# Zapier-Monorepo Frontend — Design System (v3, Canva v2 direction)

> **Document:** docs/phase-04-frontend-planning/design-system.md
> **Status:** DRAFT v3 — **aligned to the Canva design file** `Zapier-Monorepo Web App Design v2.html` (7 pages). Supersedes v2 (which was written from the same direction, pre-Canva).
> **Purpose:** Single visual truth for V1. Light theme first, dark tokens reserved. Every screen composes these tokens and patterns — nothing else.
> **Why v3:** v2 described the *intent* of the redesign. The Canva file is the *rendered* redesign. v3 replaces prose approximations with the exact values, structures, states and copy that the design actually shows, so implementation is transcription rather than interpretation.

---

## 0. Precedence — read this first

| Layer | Authority | Rule |
|---|---|---|
| **Visual layer** (tokens, type, spacing, radii, depth, layout, component anatomy, motion, copy, screen states) | **The Canva design file** | This document transcribes it. Where v2 prose and the design disagree, **the design wins** and this file is updated. |
| **Product scope** (which routes exist, what is in/out of scope, pricing/billing, workspaces) | `docs/PRD.md`, `docs/BRD.md` | The design file is an *illustration* of a product, not a scope decision. Where the design shows something the PRD excludes, **the PRD wins** and the design element is not built. |
| **Behaviour, security, data** | `pages.md`, `requirements.md`, `user-flows.md`, `TRD.md`, `DATAFLOW.md` | Unchanged by the design. The design is static; every screen still binds to real backend contracts. |

**Design file is the source of truth for the frontend.** Where this document and the design file disagree, this document is wrong until it is corrected.

**Design file index**

| Page | Canvas | Covers |
|---|---|---|
| `01 Foundations v2` | 1440×1560 | Tokens, type, radii/depth, button/input/badge/tabs/switch/kbd primitives |
| `03 Log in` | 1440×860 | Auth split layout, form, product vignette |
| `02 Landing` | 1440×2900 | Marketing page, all 10 sections |
| `04 Dashboard` | 1440×1100 | App shell, sidebar, top bar, stats, chart, automations table, right rail |
| `05 Run history + detail` | 1440×1000 | History table + filters + pagination + run-detail panel + step timeline |
| `06 Builder` | 1440×900 | Builder top bar, step library, canvas, node cards, connectors, inspector |
| `07 Mobile + states` | 1440×900 | Mobile dashboard, mobile landing, skeleton/empty/error/toast states |

**Elements present in the design that are deliberately NOT built** (PRD scope wins) — see `requirements.md` §8 for the full reconciliation table:
`Pricing` links · `Templates` nav + landing preview · `Docs`/`Product` header links · workspace switcher with `Free plan` · sidebar usage meter.

---

## 1. Design principles

1. **Neutral chrome, one accent.** Surfaces are warm neutrals. Color appears only for brand moments (orange), status (semantic), and focus. If everything is colored, nothing is.
2. **Borders over shadows.** Structure comes from 1px hairlines (shadcn pattern). Shadow only lifts floating things: popovers, dialogs, the hero workflow card, the run-detail panel.
3. **Product is the hero.** Marketing shows real UI (workflow card, run log, bento tiles of actual components) — not stock illustration, not abstract blobs.
4. **Dense but calm.** Tables and dashboard are tight. Marketing is airy (64px display type, 96–112px section rhythm).
5. **Motion explains state.** Animations clarify (running, copied, step connected). One decorative motion per page maximum.
6. **No AI tropes.** No purple-blue gradient washes, no glassmorphism blobs, no emoji icons, no left-border cards, no centered-everything pages, no "✨".

---

## 2. Tokens

### Color — paper / ink (neutrals, warm stone)

| Token | Hex | Use |
|---|---|---|
| paper | #FAF8F5 | page background |
| surface | #FFFFFF | cards, inputs, popovers, sidebar, top bars |
| sunken | #F3F0EA | table header, code wells, segmented track, skeletons, auth right panel |
| line | #E7E2D9 | default border / divider |
| line-strong | #D6CFC2 | input border, hover border, secondary button ring |
| ink | #1C1917 | headings, primary button fill, success chart bars |
| ink-2 | #57534E | body text |
| ink-3 | #6B665F | secondary text, captions, table headers, group labels (≥4.5:1 on paper) |
| ink-4 | #A8A29E | placeholder, disabled icons, connectors, decorative only |

### Color — accent "flame" (brand)

| Token | Hex | Use |
|---|---|---|
| flame-50 | #FFF1EA | tint backgrounds, active nav pill, filter count chip, empty-state icon chip |
| flame-100 | #FFE0D1 | icon chips, hover tint, "New" chip background |
| flame-300 | #FFB08A | announcement-bar link and CTA-band links on ink surfaces |
| flame-500 | #F2540B | brand fills: logo, step dots, progress, selection ring, chart accent, active nav icon |
| flame-600 | #C2410C | accent TEXT and links (5.2:1 on white), active nav icon, hero headline period |
| flame-700 | #9A3412 | link hover, chip text on flame-100 |

Rule: flame-500 is a **fill**, never body text. Text-on-flame-500 uses ink. Primary buttons are **ink**, not flame.

### Color — status (semantic, always icon + label)

| State | Fg | Bg | Icon (Lucide) |
|---|---|---|---|
| Pending | #57534E | #F3F0EA | Clock |
| Running | #1D4ED8 | #EFF4FF | Loader2 (spin, aria-live) |
| Success | #15803D | #ECFDF3 | CheckCircle2 |
| Failed | #B42318 | #FEF3F2 | XCircle |
| Skipped | #6B665F | #F3F0EA | MinusCircle |
| Suspended | #B45309 | #FFFAEB | PauseCircle |

Supporting tints used by the design: failed row bg `#FFFBFA`, failed error-card ring `#FECDCA`, error-card body text `#7A271A`, suspended body text `#7A4A0A`, success check icon `#15803D`.

Status badge: 6px radius (not pill), 22px height, 12px/500 text, 14px icon, 1px inner ring at 12% of fg.

### Color — data (dataviz, ≤2 hues + neutral)

| Token | Hex | Use |
|---|---|---|
| chart-succeeded | #1C1917 | ink bars in "Runs per day" |
| chart-failed | #DC2626 | failed bars in "Runs per day" — **deliberately distinct from status-failed #B42318** so a chart is never read as a badge |
| chart-grid | #E7E2D9 | axis/divider hairlines |

### Type

- **UI + display:** Geist (`next/font/google`). **Mono:** Geist Mono (URLs, IDs, payloads, timestamps, stat values, metrics, webhook URLs).
- Display tracks tighter: −0.03em on ≥28px, −0.02em on 17–24px, −0.01em on 20px, 0 on body.

| Token | Size / line | Weight | Tracking | Use |
|---|---|---|---|---|
| hero | 4rem / 1.05 (64px) | 600 | −0.03em | landing H1 |
| hero-sm | 2.5rem / 1.05 (40px) | 600 | −0.03em | mobile landing H1 |
| display-lg | 2.75rem / 1.1 (44px) | 600 | −0.03em | landing section H2, CTA band H2 |
| display | 2.25rem / 1.15 (36px) | 600 | −0.03em | FAQ H2, auth vignette headline, landing metric value, auth headline |
| display-sm | 1.75rem / 1.25 (28px) | 600 | −0.02em | auth H1, stat card value |
| title-lg | 1.25rem / 1.3 (20px) | 600 | −0.01em | how-it-works H3 |
| title | 1.125rem / 1.4 (18px) | 600 | 0 | bento H3, hero subcopy |
| title-sm | 1rem / 1.4 (16px) | 600 | 0 | card titles, FAQ question, section H2 in cards, error title |
| logo | 1.0625rem / 1.2 (17px) | 600 | −0.02em | wordmark |
| body-lg | 1.125rem / 1.6 (18px) | 400 | 0 | hero subcopy |
| body | 0.9375rem / 1.6 (15px) | 400 | 0 | body copy, how-it-works description, mobile subcopy |
| body-sm | 0.8125rem / 1.5 (13px) | 400 | 0 | UI labels, small body, table cells, bento body |
| caption | 0.75rem / 1.4 (12px) | 400 | 0 | captions, badges, table headers, group labels, helper text |
| mono-xs | 0.6875rem / 1.2 (11px) | 400 | 0 | kbd hints, tab-bar labels, code wells, tab-bar icon labels |
| stat-value | 1.75rem / 1.1 (28px) | **500** | −0.03em | stat card value (mono, tabular-nums) |
| metric-value | 2.25rem / 1.1 (36px) | **500** | −0.03em | landing metric value (mono, tabular-nums) |
| stat-value-sm | 1.375rem / 1.1 (22px) | 500 | −0.03em | mobile stat value (mono) |

- Weights: display 600, titles 600, UI labels 500, body 400. Headings use ink; the hero may set one phrase or a single period in flame-600.
- **Eyebrow:** 12px/500, uppercase, +0.08em, ink-3, preceded by a 6px flame-500 square.
- **Table / group header (`.th`):** 12px/500, uppercase, +0.04em, ink-3. (Distinct from eyebrow tracking.)
- **Sidebar group label:** 12px/500, ink-3, **not** uppercase, padding `0 10px 4px`.
- **Builder library group label:** 12px/500, uppercase, +0.04em, ink-3.

### Spacing & layout

- 4px base. Rhythm: 4 / 8 / 10 / 12 / 16 / 20 / 24 / 32 / 48 / 64 / 96 / 112.
- Marketing container 1200px (padding 0 24px); auth split (left 520px basis / right 480px basis, ≈52/48); app content max 1280px, gutters `24px 32px 32px`.
- Sidebar 248px (collapses to a 64px icon rail <lg, sheet on mobile). Right rail 280–340px at ≥xl. Builder library 260px, inspector 320px, canvas node cards 300px.
- Top bar 56px everywhere (app, builder, mobile). Marketing header 64px.
- Section rhythm on marketing: 96–112px desktop. Hero block padding `96px 24px`.
- Hero + CTA bands sit on a **dot grid** (1px dots, 24px pitch, `#D6CFC2`), masked to fade at edges (hero: radial mask from 30%/40%; marquee: linear mask 12%–88%). Not a gradient.

### Radii

- **lg 12px** cards, popovers, dialogs, nodes, run-detail panel, CTA band · **md 8px** buttons, inputs, menu items, nav items, library items · **sm 6px** badges, kbd, chips, icon chips · **full** avatars, toggle thumbs, step-number circles, tag chips.
- Nested radii follow outer − padding (card 12 → inner tile 8).

### Depth (only these)

- `ring`: `0 0 0 1px #E7E2D9` — default for cards.
- `xs`: `0 1px 2px rgba(28,25,23,.06)` — buttons, inputs.
- `pop`: `0 8px 24px -8px rgba(28,25,23,.18)` (+ ring) — popovers, dialogs, hero workflow card, run-detail panel, toast, error card.
- `focus`: `0 0 0 2px #FAF8F5, 0 0 0 4px #F2540B` — every focusable element; also the selected builder node ring.
- `hairline`: `0 1px 0 0 #E7E2D9` (top bar / card header bottom) and `inset -1px 0 0 #E7E2D9` (sidebar right edge) / `inset 1px 0 0 #E7E2D9` (inspector left edge, auth right panel left edge).

---

## 3. Components (shadcn-style, composed from the tokens)

**Button** — `display:inline-flex; align-items:center; gap:8px; border-radius:8px; font:500 14px/1;`

| Variant | Fill | Text | Ring / shadow |
|---|---|---|---|
| `primary` | #1C1917 (ink) | #FFF | xs |
| `accent` | #F2540B (flame-500) | #1C1917 | none |
| `secondary` | #FFF | #1C1917 | line-strong + xs |
| `ghost` | transparent | #57534E | none (hover: sunken bg, ink text) |
| `link` | transparent | #C2410C | none |
| `destructive` | #B42318 | #FFF | none |

Hover: primary → #292524; accent → #E04A05; secondary → paper bg; ghost → sunken bg.
Sizes: **30** (sm, 13px/500, padding 0 10px — in-card actions) · **32** (sm+, 13px, padding 0 12px — run-detail panel) · **34** (builder top bar / error retry) · **36** (default) · **40** (auth) · **44** (`btn-lg`, 15px, padding 0 20px — marketing hero, CTA band, mobile default).
Icon left, 16px, 8px gap (14px in compact sizes). Loading = spinner + gerund label ("Publishing…"), width locked. Disabled = 50% opacity + `aria-disabled`. Optional trailing `kbd` hint on desktop (⌘K, ⌘N, ⌘↵) at 11px mono, 70% opacity.
Accent buttons: **max one per view**.

**Input / Select / Textarea** — md radius, surface, line-strong ring, xs. Height **40** on auth, **36** standard, **34** in the builder inspector. Focus = `focus`. Error = ring #B42318 + 14px icon + text below (`aria-describedby`). Labels 13px/500 ink. Helper 12px ink-3. Password has a 32px show/hide button at `right 4px`; "Forgot password?" is a 13px/500 link on the label row. Monospace values (e.g. `{{ trigger.customer }}`) use Geist Mono. The builder name field is a borderless transparent input (15px/600).

**Filter chip / select (`.sel`)** — inline-flex, 32px height, 8px radius, surface, line-strong ring, 13px/500 ink, 14px chevron, 8px gap. May carry a count chip: mono 11px, padding 2px 6px, radius 4, flame-50 bg, flame-700 text.

**Card** — surface, lg radius, `ring`. Header row = title (16px/600) + optional description (13px ink-3) + right-aligned actions; header separated by `hairline` bottom. Body padding 16–24px. Footer separated by a line.

**Stat card** — surface, lg radius, `ring`, padding `16px 20px`, min basis 180px. Caption 12px ink-3; value 28px/500 **mono** tabular-nums ink; optional 64×24 sparkline in flame-500 (stroke 1.75); delta chip = badge with success/failed tint and an arrow icon.

**Spotlight card (React Bits pattern, marketing bento only):** on hover a 240px radial of flame-100 follows the cursor behind content; border shifts to line-strong. Static fallback: flat card.

**Table** — lives in a card with `overflow:hidden`; inner `overflow-x:auto` wrapper with a `min-width` track (720px dashboard, 640px history). Header row: `sunken` bg, `.th` labels, padding `10px 20px`. Body rows padding `12px 20px` (dashboard) / `11px 20px` (history), 1px row dividers, gap 16px. Cell type: name 14px/500 ink (truncated, ellipsis), steps 13px ink-2 (truncated), IDs/times/durations 12px **mono** ink-2, status badge 14px icon. Hover = sunken at 50%. Row actions = trailing ghost 28px icon button. Failed row: bg `#FFFBFA` + 12px error sentence in #B42318 + inline "View step" link. Selected row = flame-50 bg + `inset 2px 0 0 #F2540B` left edge.

**Tabs (segmented)** — sunken track, 8px radius, 3px padding, 2px gap; segment padding `4px 10px`, 13px/500; active segment = surface + xs, ink text; inactive ink-2.

**Toggle/Switch** — 36×20 track, 2px padding, 16px white thumb, full radius; on = ink, off = line-strong.

**Badge / chip** — sm radius (6px), 22px height, 12px/500, 8px horizontal padding, 6px gap, optional 14px icon. Tag chips (e.g. "New") are radius 4 with 11px/500 text.

**Kbd** — mono 11px on sunken, radius 6, 1px line ring, padding `4px 6px`.

**Command palette (⌘K):** dialog centered at 20% from top, 560px, search input, grouped results (Automations, Runs, Actions), kbd hints. Appears from the top-bar search.

**Toast (Sonner pattern):** bottom-right, surface, `pop`, 16px icon + one line 13px/500 + optional action. "Copied" uses a Check icon in #15803D.

**Navigation**
- *Marketing header:* 64px, sticky, paper at 85% with a 1px bottom line. Logo left (28px flame-500 tile, 8px radius, ink bolt glyph, 17px wordmark). Nav links: 14px/500 ink-2, padding `8px 10px`, radius 8, hover = sunken bg. Right: `Log in` (ghost) + `Create automation` (primary).
- *Dashboard shell:* sidebar 248px, surface, `inset -1px 0 0` right line, padding 12px. Top bar 56px: breadcrumb left (workspace 13px ink-3 / `/` ink-4 / page 13px/500 ink), ⌘K search field center-left (34px, max-width 400px, 24px left margin, 34px left icon, kbd right), right: theme toggle + help (34px ghost icon buttons). Content padding `24px 32px 32px`.
  - *Sidebar:* top = account chip (28px avatar, name 14px/600, email 12px ink-3 truncated, 28px sign-out icon button) — **no workspace switcher, no plan/usage meter** (PRD scope, see `requirements.md` §8).
  - *Nav groups:* Overview (Dashboard) · Automations (Create automation, History) · Account (Analytics, Connections, Settings) — the design's `Templates` item and the `Analytics` item follow the scope rules in `requirements.md` §8 (Templates excluded; Analytics added by V1 scope). Group label 12px/500 ink-3, not uppercase, padding `0 10px 4px`; items gap 2px.
  - *Nav item:* 32px height, radius 8, padding `0 10px`, gap 10px, 16px icon (stroke 1.75), 14px/500 ink-2. Hover = sunken bg + ink text. **Active** = flame-50 bg + ink text + **flame-600 icon**.
- *Mobile:* sidebar → sheet; header 56px white with logo + page title + 44px icon buttons; **bottom tab bar 64px**, white, `0 -1px 0 0` top line, 4 tabs (Dashboard, Create automation, History, Settings) with 20px icons + 11px/500 labels, active = ink, inactive = ink-3.

---

## 4. Marketing patterns (landing)

Section order is fixed: **announcement bar → header → hero → marquee → bento → how it works → metrics → FAQ → final CTA → footer.** There is **no templates preview section**.

1. **Announcement bar** — ink bg #1C1917, paper text 13px/1.5, centered, padding `8px 16px`. Link in flame-300 with `→`. Static sentence only, no external link. Hidden by default (V1 may omit it).
2. **Header** — see §3 Navigation. Nav links: `How it works` (#how), `FAQ` (#faq). **No `Product`, `Templates`, `Pricing`, `Docs` links** (no routes — PRD scope).
3. **Hero** — dot-grid section with a radial mask fading to paper from 30%/40%. Two columns: left `flex 1 1 480px`, right `flex 1 1 440px`, gap 64px, container padding `96px 24px`.
   - **Eyebrow badge:** 28px height, radius 6, surface + ring, 13px/500 ink, containing a "New" tag chip (flame-100 bg, flame-700 text, radius 4, 11px) + the announcement sentence.
   - **H1:** 64px, two lines, one phrase and a single period in flame-600.
   - **Subcopy:** 18px/1.6 ink-2, max-width 520px.
   - **CTA pair:** accent `Create automation` (with 16px arrow icon) + secondary `See a live run` (anchors to the run-log bento tile, `#runs`).
   - **Reassurance row:** 3 items, 13px ink-2, gap `8px 24px`, each with a 14px green (#15803D) check icon.
   - **Right — live workflow card:** max-width 480px, surface, radius 12, `ring` + `pop`, padding 20px, gap 16px. Header: 32px flame-50 icon chip + 14px/600 title + 12px ink-3 subtitle + status badge. Steps: sunken rows (radius 8, padding `10px 12px`, gap 10px) with a 28px white index chip (radius 6, ring, 12px/600), 13px/500 title, 11px mono subtitle, status badge. Footer: sunken strip (radius 8, padding `6px 6px 6px 12px`) with a 12px mono webhook URL (truncated) + a 28px secondary `Copied` button with a green check.
   - The webhook URL is **rendered from the backend** (`webhookUrl`); the design shows a production-shaped placeholder.
4. **Integration marquee** — "Works with the tools you already use" centered 13px ink-3. Chips: 44px height, radius 8, surface + ring, gap 10px, 24px sunken glyph chip (radius 6, 12px/600) + 14px/500 name. Track: `display:flex; gap:12px; width:max-content`, 30s linear infinite marquee, masked `linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)`. Static under reduced motion. Generic names only — never third-party logos.
5. **Bento features** — 12-col grid, gap 16px, **row 1 = 7/5, row 2 = 4/4/4** (flex `7 1 520px` / `5 1 360px` / `1 1 300px` ×3). Each tile: surface, radius 12, ring, padding 24px, gap 20px; H3 18px/600 + one sentence 14px/1.6 ink-2 + a **real UI fragment**. Spotlight hover.
   Fragments: canvas node chain (Catch webhook → Filter → Send email, 32px connectors, 24px icon chips) · dark mono run log (`#1C1917` bg, `#D6D0C8` text, 12px/1.8, timestamps in `#8A847C`, success in `#86EFAC`, running in `#FFB08A`) · toggle card · error card (#FEF3F2 bg + #FECDCA ring, 18px alert icon, 13px #7A271A text, 28px `Retry` secondary) · `Test` + `Publish ⌘↵` pair.
6. **How it works** — eyebrow `How it works` + H2 44px, then 3 columns (gap 48px) each with a 1.5px dashed flame-500 top border, padding-top 20px, a 28px ink circle number (13px/600, 4px paper ring, pulled −35px over the border), H3 20px/600, body 15px/1.6 ink-2.
7. **Metrics strip** — one card, 4 equal cells (gap 16px), each with `inset -1px 0 0` right hairline, padding `28px 32px`: value 36px/500 **mono** tabular-nums ink + label 13px ink-3. **Real values only** — the design shows bracketed placeholders (`[00M]`, `[00+]`); they must be replaced by real data or the strip is hidden.
8. **FAQ** — max-width 760px, centered; eyebrow `FAQ` + H2 36px; rows separated by a 1px line, padding `18px 0`, gap 8px; question 16px/500 ink with a 16px chevron; answer 14px/1.6 ink-2. Chevron rotates 200ms.
9. **Final CTA band** — ink bg #1C1917, radius 12, padding `72px 48px`, dot grid (24px pitch, rgba(250,248,245,.09)), H2 44px paper, body 16px/1.6 `#D6D0C8`, buttons: accent `Create automation` + ghost-outline `Log in` (1px #57534E ring, paper text).
10. **Footer** — surface, `0 -1px 0 0` top line, padding `48px 24px 32px`. **3 link columns** (`Product`, `Resources`, `Company`) + left brand block (logo, tagline 13px/1.6 ink-2, `All systems normal` status badge — success tint + 6px dot). Bottom: 12px ink-3 copyright line.

---

## 5. Auth patterns

**Split layout.** Left (paper #FAF8F5, padding `32px 48px`): logo top-left; centered form column max 400px, gap 28px between blocks; footer links (Privacy, Terms, Help) 12px ink-3 at the bottom. Right (sunken #F3F0EA + dot grid, `inset 1px 0 0` left line, padding 48px, hidden <lg): headline 36px with a flame-600 period, sub 15px/1.6 ink-2, and a **product vignette** card (surface, radius 12, `ring`+`pop`, padding 18px, gap 14px):
- Row: 14px/600 `Lead to CRM · Run #1281` + a status badge (the design shows a **Failed** run).
- Timeline: 18px status icons on a 1px #E7E2D9 rail (min-height 14px), title 13px/500 ink, 11px mono subtitle.
- Error strip: #FEF3F2 bg, radius 8, 13px/1.5 #7A271A sentence.

**Form block.** H1 28px/600 + sub 14px ink-3. OAuth row: **two secondary buttons side by side** (flex 1 1 0, gap 12px) with provider glyph — labels `Google` / `GitHub`, with `aria-label="Continue with Google"` / `"Continue with GitHub"`. Divider: 1px line — `or with email` (12px ink-3) — 1px line. Fields: gap 18px, label 13px/500, input 40px. Error = ring #B42318 + 14px AlertCircle icon + 12px text. Password shows a 32px show/hide button. Submit = ink, full width, 40px. Below: 13px centered `New here? Create an account`. Sign-up adds a name field and a 4-segment password strength bar (line → flame-500).
Forgotten/reset pages reuse the left column only, with a centered icon chip.

---

## 6. Dashboard & app patterns

### Shell
- Sidebar 248px (surface, inset right hairline, padding 12px, gap 16px). Top bar 56px (paper at 90%, bottom hairline, padding `0 24px`, gap 16px). Content area padding `24px 32px 32px`, flex wrap, gap 24px, align-start. Main column `flex 1 1 640px`; right rail `flex 1 1 280px; max-width 340px` at ≥xl.
- **Sidebar top:** account chip — 28px avatar (sunken circle, initials 11px/600), name 14px/600, email 12px ink-3 (truncated), 28px ghost sign-out icon button. **No workspace switcher, no plan/usage meter** (PRD scope).
- **Sidebar bottom:** user menu row (avatar + name + email + sign-out button).

### Dashboard (`/dashboard`)
- **Page header:** H1 `My automations` (24px/600, −0.02em) + description 14px ink-3; right: primary `Create automation` (Plus icon + `⌘N` kbd). The design's secondary `Docs` button is **not built** (no route — PRD scope).
- **Stat row:** 4 stat cards, gap 16px, basis `1 1 180px`.
- **Runs-per-day chart card:** header `16px 20px` — H2 `Runs per day` (16px/600) + legend (8px rounded-2px swatch + 12px label: Succeeded = ink #1C1917, Failed = **#DC2626**) — and segmented range tabs `7d / 30d / 90d` (30d default). Plot area height 180px, padding 20px, bars flex-1 with 6px gap; each bar column stacks a failed segment (radius `2px 2px 0 0`) over a succeeded segment (radius 0). Hover tooltip.
- **Automations table card:** header `16px 20px` — H2 `Automations` + right: search input (160px, 30px, magnifier icon) + secondary `View history` (30px). Columns: Name (2.2fr) · Steps (1.6fr) · On (72px) · Last run (1fr) · Status (112px) · actions (32px). Track min-width 720px. `On` = 36×20 toggle. `Last run` = 12px mono. `Status` = badge with 14px icon. Trailing = 28px ghost overflow button. Failed row = `#FFFBFA` bg + error sentence 12px #B42318 + `View step` link.
- **Right rail:**
  - *Needs attention* — card padding `16px 20px`: H2 14px/600 + items (gap 10px). Item = 16px status icon + 13px/1.5 text with the automation name in 600 and a trailing link; failed item bg #FEF3F2, suspended item bg #FFFAEB.
  - *Getting started* — card padding `16px 20px`: H2 14px/600 + mono `2 / 4` counter; 6px progress track (line) with flame-500 fill; checklist rows 13px with a 16px circle (done = #15803D with a white check, todo = surface + 1.5px line-strong ring).

### Run history (`/history`)
- **Sidebar:** simplified flat variant — logo + workspace name only, then a flat nav list (Dashboard, Create automation, History, Connections, Settings) with the same 32px items and the same active treatment. **No groups, no switcher, no meter, no `Templates` item** (PRD scope).
- **Top bar:** breadcrumb only.
- **Page header:** H1 `Run history` + description 14px ink-3.
- **Filter row** (gap 8px): search input (200px, 32px, placeholder `Search by run ID`) + `Status` chip (with count chip) + `All automations` chip + `Last 30 days` chip. All 32px, radius 8, surface + line-strong ring, 13px/500, 14px chevron.
- **Table:** columns Run (96px, 12px mono) · Automation (2fr, 14px/500) · Status (112px badge) · Took (72px, 12px mono) · Started (1fr, 12px mono). Track min-width 640px, row padding `11px 20px`. Selected row = flame-50 bg + `inset 2px 0 0 #F2540B`.
- **Pagination footer** (padding `12px 20px`, hairline top): left 12px ink-3 summary `1–25 of 1,284 · runs are kept for 90 days`; right `Previous` / `Next` (30px secondary, `Previous` disabled at 50%).
- **Run-detail panel** — a **480px inline side panel** beside the table (surface, radius 12, `ring` + `pop`), *not* an overlay sheet. On narrow screens it becomes a full-screen sheet/bottom sheet.
  - Header (padding `18px 20px`, hairline bottom): 16px/600 automation name + 12px mono `run_8f2a91 · started 12:04:01` + status badge; actions `Retry run` (primary, 32px, rotate-ccw icon) + `Copy ID` (secondary, 32px, copy icon).
  - Timeline (padding 20px): 20px status icons on a 1px #E7E2D9 rail (min-height 16px); step title 14px/500 ink + duration 12px mono ink-3 on the same row; failed step expands to an error card (#FEF3F2 bg, #FECDCA ring, padding 12px): 13px/1.5 #7A271A sentence, then `Retry from this step` (28px secondary) + `Check connection` (12px/500 #B42318 link); every step ends with a code well (sunken, radius 8, 11px mono, single-line truncated).

### Builder (`/zap/create`, `/zap/[id]`)
- **Top bar** 56px, surface, padding `0 16px`, gap 12px: back ghost button (34px, 16px arrow-left) + 1px vertical divider + editable name input (220px, borderless transparent, 15px/600, −0.01em) + `Draft` badge (sunken/ink-3) + saved indicator `Saved · 12:04` (12px ink-3 with a 14px green check). Right: `Test` (secondary, 14px play icon) + `Publish` (primary + `⌘↵` kbd).
- **Step library** (left, 260px, surface, inset right hairline, padding `16px 12px`): search field (34px, magnifier icon, placeholder `Search steps`), then groups — `Triggers` (Webhook, Schedule, App event) and `Actions` (Send email, Add spreadsheet row, Post message, Filter, Delay). Group label 12px/500 uppercase +0.04em ink-3, padding `0 8px 4px`. Item = 36px height, radius 8, padding `0 8px`, gap 10px, 13px/500 ink + 24px icon chip (radius 6, flame-50/flame-600 for triggers, sunken/ink for actions). Drag is **canvas-pan only**; order comes from `sortingOrder`.
- **Canvas** (center, dot grid on paper, padding `40px 24px 96px`): a **vertical** stack of node cards, max-width **300px**, centered.
  - *Node card:* surface, radius 12, padding `12px 14px`, gap 12px; 32px icon chip (radius 8, flame-50/flame-600 for triggers, sunken/ink for actions, 13px/600 index); title 14px/500 ink + 12px ink-3 subtitle; status badge (14px icon). Unselected ring = line-strong + xs; **selected ring = `focus`** (2px paper + 4px flame-500) + `pop`.
  - *Connector:* **vertical** — a 1.5px #A8A29E line 20px above and below a 22px circular `+` insert handle (surface + line-strong ring, 12px plus icon). **Not curves.**
  - *Add step:* a full-width 48px dashed-outline button (1.5px line-strong, radius 12, 13px/500 ink-2, plus icon).
  - *Zoom cluster:* bottom-left, surface, radius 8, ring + xs — 32px zoom-out, mono 12px `100%`, 32px zoom-in, 32px fit-to-screen (separated by a left border).
- **Inspector** (right, 320px, surface, `inset 1px 0 0` **left** line): header (padding 16px, hairline bottom) = 28px step-index chip (radius 6, sunken, 12px/600) + 14px/600 title + 12px ink-3 kind; segmented tabs `Setup / Test / Settings`. Body (padding 16px, gap 16px): labelled fields — label 13px/500, input 34px, `{{ref}}` values in Geist Mono, helper 12px ink-3; then a full-width `Test step` secondary button (14px play icon).

---

## 7. Icons, motion, micro-interactions

- **Lucide only.** 16px in UI, 18–20px in marketing tiles and the auth vignette, stroke 1.75 (2 for filled brand glyphs). Logo mark = custom bolt in a flame-500 8px-radius tile (brand only). Step-number chips are numeric, not icons.
- **Motion tokens:** 120ms hover/focus · 200ms dialogs/panels/accordions · 600ms page fade-in-up (8px) · 1.6s beam sweep on the hero connector · 30s marquee loop · 1.4s skeleton shimmer · count-up 900ms.
- **React Bits-inspired accents (pick max one per section):** shiny text sweep on the eyebrow badge, border-beam on the hero workflow card, spotlight cards on the bento, marquee for integrations, count-up for metrics.
- **All** animation is disabled under `prefers-reduced-motion: reduce` (instant states, marquee static, beam hidden, shimmer off).
- Micro: copy-URL → check + `Copied` toast; toggle flips instantly, rolls back + error toast on rejection; button press scale .98; table row hover reveals actions; skeleton shimmer 1.4s.

---

## 8. Loading / Empty / Error

- **Skeleton** — mirrors the final layout on `sunken` with a slow shimmer (`linear-gradient(90deg,#F3F0EA 25%,#EBE6DD 50%,#F3F0EA 75%)`, `background-size:200% 100%`, 1.4s linear infinite, radius 6). Table skeleton = a 14px title bar (40% width) + three 36px row bars (last one 80% width). Stat skeleton = label + value bars. Builder = dotted canvas with ghost nodes.
- **Empty** — card on a dot-grid surface, centered, padding `32px 24px`, gap 12px, text-align center: 40px icon chip (flame-50 bg, flame-600 icon, radius 8) + title 16px/600 ink + one sentence 14px/1.6 ink-2 (max-width 300px) + a single primary CTA. Examples: no automations → `No automations yet`; no runs → `Fire a test run` + `Runs are kept for 90 days.`
- **Error** — card, padding 24px, `flex-start`, gap 14px: 40px icon chip (#FEF3F2 bg, #B42318 AlertTriangle, radius 8) + title 15px/600 ink + one sentence 14px/1.6 ink-2 + actions: `Retry` (secondary, 34px) and `Contact support` (13px/500 flame-600 link). No codes, no traces. Inline field errors per forms.
- **Toast** — surface, radius 12, `ring` + `pop`, padding `12px 14px`, gap 10px: 16px Check icon in #15803D + label 13px/500 ink.

---

## 9. Responsive

Mobile-first. `<sm` single column; `sm–lg` two columns, sidebar becomes a sheet; `≥lg` fixed sidebar, 4-col stats; `≥xl` right rail. Touch targets ≥ 44px (mobile buttons are 44px tall by default; icon buttons 44×44).
- **Mobile dashboard (390px):** 56px white header (logo + page title + 44px search button); content padding 16px, gap 12px; stat cards in a **2-column grid** (gap 12px, padding `12px 14px`, value 22px mono, delta 12px #15803D, no sparkline); an `Automations` section header (15px/600 + `View history` link 13px/500 flame-600); automations render as **stacked cards** (padding `12px 14px`, name 14px/500, meta 12px, status badge) — **not** a scrolling table; **bottom tab bar 64px** (Dashboard, Create automation, History, Settings).
- **Mobile landing (390px):** 56px header (logo + 44px hamburger); hero H1 40px, body 15px, CTAs stacked full-width (accent then secondary), workflow card with 22px index chips.
- **Builder on mobile:** canvas full-bleed, library and inspector open as bottom sheets.
- History table scrolls horizontally with the first column sticky.

---

## 10. Dark theme (reserved, ships after V1)

Tokens remap: paper #0C0A09, surface #171412, sunken #1F1B18, line #2B2622, ink #FAF8F5, ink-2 #D6D0C8, flame-500 unchanged, flame-600 → #FB923C for text. Same radii/borders. ThemeToggle present in UI from day one; light only in V1.

---

## 11. Freeze rule

This file is the only source of color, type, spacing, radii, depth, layout, motion and component anatomy. It transcribes the Canva design file; where the two disagree, the **design file wins** and this file must be updated in the same PR. Build components in shadcn form (Radix primitives + these tokens) and pull motion accents from React Bits only where §4/§7 allow. No new palettes, fonts, radii, or shadows. Anything not here needs a PR to this file first. Scope is not governed here — see `requirements.md` §8.

---

## Changelog v2 → v3

| Area | v2 (prose) | v3 (Canva v2, transcribed) |
|---|---|---|
| Authority | Prose description of the redesign | **Canva design file is the source of truth**; PRD/BRD still own scope (§0 precedence table) |
| Type scale | 9 steps, 3rem display-lg | 18 explicit steps incl. **40 / 44 / 36 / 28 / 22 / 18 / 17 / 11px** |
| Stat / metric values | 28px/600 | **28px/500 mono**, metric **36px/500 mono** |
| Accent palette | 4 flames | + **flame-300 #FFB08A** (links on ink surfaces) |
| Data color | failed overlay #B42318 | chart-failed **#DC2626** (distinct from status-failed) |
| Nav active | flame-50 + 2px dot-icon tint | flame-50 + **flame-600 icon** |
| Buttons | 32/36/40/48 | **30/32/34/36/40/44** + `btn-lg` 15px |
| Tabs / selects | — | **filter chip** (`.sel`) with count chip, 32px |
| OAuth buttons | full-width, stacked (stale §2 vs §4) | **side by side** |
| Auth heading | 24px | **28px**; vignette headline 36px; vignette shows a **failed** run |
| Hero CTA | `See how it works` | **`See a live run`** (anchor) |
| Bento grid | 7/5, 4/4/4, 5/7 | **7/5 then 4/4/4** |
| Landing sections | 9 incl. Templates preview | 10, **no templates preview**, metrics values must be real |
| Footer | 4 link columns | **3 columns** (Product / Resources / Company) |
| Run detail | 480px overlay drawer | **480px inline side panel** (+ sheet on mobile) |
| History sidebar | grouped | **flat** variant on history; grouped on dashboard |
| Builder node width | 280px | **300px** |
| Builder connectors | 1.5px ink-4 **curves** | **vertical** 1.5px #A8A29E + 22px `+` handle |
| Builder inspector | 320px | 320px + **inset left** line, step-index chip, mono `{{ref}}` fields |
| Mobile tab bar | 56px | **64px**, 20px icons + 11px labels |
| Mobile dashboard | (not specified) | **cards**, not a table; 2-col stat grid; 56px header |
| Empty / error | icon chip 40px | exact card anatomy (dot-grid empty, tinted error card, toast) |
| Brand | "Zapier-Monorepo" | **Zapflow** |
