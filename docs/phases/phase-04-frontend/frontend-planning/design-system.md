# Zapier-Monorepo Frontend — Design System (v2, SaaS direction)

> **Document:** docs/phase-04-frontend-planning/design-system.md
> **Status:** DRAFT v2 — supersedes v1 (indigo/Inter "template" look)
> **Purpose:** Single visual truth for V1. Light theme first, dark tokens reserved. Every screen composes these tokens and patterns — nothing else.
> **Why v2:** v1 read as a generic AI/Tailwind starter: indigo-600 everywhere, Inter, big soft rounded cards, shadow soup, gradient-ish hero. v2 follows how shipped SaaS products look and behave: shadcn/ui discipline (neutral surfaces, 1px borders, small radii, restrained shadow), React Bits-style motion accents used sparingly, and Zapier-style product storytelling (warm canvas, one loud accent, workflow visuals as hero).

---

## 0. Design principles

1. **Neutral chrome, one accent.** Surfaces are warm neutrals. Color appears only for brand moments (orange), status (semantic), and focus. If everything is colored, nothing is.
2. **Borders over shadows.** Structure comes from 1px hairlines (shadcn pattern). Shadow only lifts floating things: popovers, dialogs, the hero workflow card.
3. **Product is the hero.** Marketing shows real UI (workflow card, run log, bento tiles of actual components) — not stock illustration, not abstract blobs.
4. **Dense but calm.** Tables and dashboard are tight (36–40px rows, 13–14px text). Marketing is airy (large display type, 96–128px section rhythm).
5. **Motion explains state.** Animations clarify (running, copied, step connected). One decorative motion per page maximum.
6. **No AI tropes.** No purple-blue gradient washes, no glassmorphism blobs, no emoji icons, no left-border cards, no centered-everything pages, no “✨”.

---

## 1. Tokens

### Color — paper / ink (neutrals, warm stone)
| Token | Hex | Use |
|---|---|---|
| paper | #FAF8F5 | page background |
| surface | #FFFFFF | cards, inputs, popovers |
| sunken | #F3F0EA | table header, code wells, segmented track |
| line | #E7E2D9 | default border / divider |
| line-strong | #D6CFC2 | input border, hover border |
| ink | #1C1917 | headings, primary button fill |
| ink-2 | #57534E | body text |
| ink-3 | #6B665F | secondary text, captions (≥4.5:1 on paper) |
| ink-4 | #A8A29E | placeholder, disabled icons (decorative only) |

### Color — accent "flame" (brand)
| Token | Hex | Use |
|---|---|---|
| flame-50 | #FFF1EA | tint backgrounds, active nav pill |
| flame-100 | #FFE0D1 | icon chips, hover tint |
| flame-500 | #F2540B | brand fills: logo, step dots, progress, selection ring, chart accent |
| flame-600 | #C2410C | accent TEXT and links (5.2:1 on white) |
| flame-700 | #9A3412 | link hover |

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

Status badge: 6px radius (not pill), 12px/500 text, 1px inner ring at 12% of fg.

### Type
- **UI + display:** Geist (next/font/google). **Mono:** Geist Mono (URLs, IDs, payloads, timestamps in logs).
- Display tracks tighter: −0.03em on ≥32px, −0.01em on 20–28px, 0 on body.
- Scale (never outside it): hero 4rem/1.05 · display-lg 3rem/1.1 · display 2.25rem/1.15 · display-sm 1.5rem/1.25 · title 1.125rem/1.4 · body 0.9375rem/1.6 · body-sm 0.8125rem/1.5 · caption 0.75rem/1.4 · mono-sm 0.8125rem/1.5.
- Weights: display 600, titles 600, UI labels 500, body 400. Headings use ink; hero may set one phrase in flame-600.
- Eyebrow: 12px/500, uppercase, +0.08em, ink-3, preceded by a 6px flame-500 square.

### Spacing & layout
- 4px base. Rhythm: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 96.
- Marketing container 1200px; auth split 50/50 (form column max 400px); dashboard full-width, content max 1280px, 24–32px gutters; sidebar 248px (collapses to 64px icon rail at <lg).
- Section rhythm on marketing: 96px desktop / 64px mobile.
- Hero + CTA bands sit on a **dot grid** (1px dots, 24px pitch, line color at 60%), masked to fade at edges. Not a gradient.

### Radii
- **lg 12px** cards, popovers, dialogs · **md 8px** buttons, inputs, menu items · **sm 6px** badges, kbd, chips · **full** avatars and toggle thumbs only.
- Nested radii follow outer − padding (card 12 → inner tile 8).

### Depth (only these)
- `ring`: 0 0 0 1px line — default for cards.
- `xs`: 0 1px 2px rgba(28,25,23,.06) — buttons, inputs.
- `pop`: 0 8px 24px -8px rgba(28,25,23,.18) + ring — popovers, dialogs, hero workflow card.
- `focus`: 0 0 0 2px paper, 0 0 0 4px flame-500 — every focusable element.

---

## 2. Components (shadcn-style, composed from the tokens)

**Button** — heights 32 / 36 / 40 / 48. `primary` = ink fill, white text, hover #292524; `accent` = flame-500 fill with ink text (marketing CTA only, max one per view); `secondary` = surface + line-strong ring + xs; `ghost` = transparent, hover sunken; `link` = flame-600 text; `destructive` = #B42318 fill (confirm dialogs only). Icon left, 16px, 8px gap. Loading = spinner + gerund label ("Publishing…"), width locked. Disabled = 50% opacity + aria-disabled. Optional trailing `kbd` hint on desktop (⌘K, ⌘↵).

**Input / Select / Textarea** — 36px (40 on auth), md radius, surface, line-strong ring, xs; focus = `focus`; error = ring #B42318 + icon + text below (aria-describedby). Labels 13px/500 ink. Helper 12px ink-3. Password has show/hide; "Forgot password?" is a link on the label row. OAuth buttons are full-width secondary with provider glyph, below an "or" divider.

**Card** — surface, lg radius, `ring`. Header row = title (title/600) + optional description (ink-3) + right-aligned actions; body padding 20–24px; footer separated by a line. **Stat card:** caption label, 28px/600 value (tabular-nums), delta chip (success/failed tint, with arrow icon) + optional 7-day sparkline in flame-500.

**Spotlight card (React Bits pattern, marketing bento only):** on hover a 240px radial of flame-100 follows the cursor behind content; border shifts to line-strong. Static fallback: flat card.

**Table** — lives in a card. Sticky header on sunken, 12px/500 ink-3 uppercase labels, rows 44px, hover sunken at 50%, 1px row dividers, mono for IDs/time, truncated cells with tooltip, row actions in a trailing ghost icon menu. Selected row = flame-50 + 2px flame-500 inset on left edge only in dashboards (never on cards).

**Tabs (segmented):** sunken track, 8px radius, active segment = surface + xs. **Toggle/Switch:** 36×20 track, ink when on, line-strong off, 16px white thumb. **Badge / chip:** sm radius. **Kbd:** mono 11px on sunken, ring.

**Command palette (⌘K):** dialog centered at 20% from top, 560px, search input, grouped results (Automations, Runs, Actions), kbd hints. Appears from top-bar search.

**Toast (Sonner pattern):** bottom-right, surface, `pop`, icon + one line + optional action. "Copied" uses Check icon.

**Navigation**
- *Marketing header:* 64px, sticky, paper at 80% with 1px bottom line on scroll. Logo left; Product / Templates / Pricing / Docs centered-left; right: Log in (ghost) + **Start free** (primary). Announcement bar above (ink bg, 13px, link with arrow).
- *Dashboard shell:* sidebar 248px, surface, right line. Top: workspace switcher (avatar chip + name + chevrons-up-down). Groups: Overview (Dashboard) · Automations (Create, History, Templates) · Account (Connections, Settings). Item = 32px, md radius, 16px icon, 14px/500; **active = flame-50 bg, ink text, flame-500 2px dot-icon tint**; hover sunken. Bottom: plan/usage meter + user menu. Top bar 56px: breadcrumb left, ⌘K search field center-left, right: theme toggle, help, avatar menu.
- *Mobile:* sidebar → sheet; bottom tab bar (Dashboard, Create, History, Settings) 56px with 20px icons + 11px labels.

---

## 3. Marketing patterns (landing)

1. **Announcement bar** → **Header** → **Hero**: left-aligned (not centered). Eyebrow, hero headline (one phrase in flame-600), 1–2 sentence subcopy (ink-2, max 52ch), CTA pair (accent "Start free" + secondary "See how it works"), 3 reassurance micro-points with check icons. Right: **live workflow card** (pop shadow) — trigger → steps with status badges and a running step; animated "beam" travels the connector; copy-URL chip with "Copied". Behind: dot grid.
2. **Integration marquee** — "Works with the tools you already use": 8–10 neutral chips with simple glyph + app name, infinite scroll (paused on hover, static under reduced-motion). Use generic names or the user's own connector list — never third-party logos without licence.
3. **Bento features** (shadcn/React Bits style): 12-col grid, asymmetric tiles (7/5, 4/4/4, 5/7). Each tile = title, one sentence, and a **real UI fragment** (step list, run log lines in mono, toggle + success rate, error sentence with Retry). Spotlight hover.
4. **How it works** — 3 numbered steps connected by a dashed flame-500 line; step number in 28px ink circle.
5. **Metrics strip** — 4 counters (count-up on view, tabular-nums), hairline dividers between. Only real/placeholder-labelled numbers.
6. **Templates preview** — 6 cards (icon pair "A → B", name, step count, "Use template" link).
7. **FAQ** accordion (shadcn style, chevron rotates 200ms).
8. **Final CTA band** — ink background, paper text, dot grid in white at 8%, accent button.
9. **Footer** — 4 link columns, logo + one line, status dot "All systems normal", © line.

---

## 4. Auth patterns

**Split layout.** Left 50%: logo top-left, centered form column (max 400), footer links. Right 50% (hidden <lg): sunken panel with dot grid, a **product vignette** (run-log card + success badge) and one short customer-neutral line ("Every run, step by step.") — no fake testimonials. Heading 24px/600, subcopy ink-3. Primary submit is **ink** full-width 40px. OAuth row = two secondary buttons side-by-side. Footer line: "New here? Create an account". Sign-up adds name field + password strength bar (4 segments, line→flame-500). Forgot/reset pages reuse the left column only with a centered icon chip.

---

## 5. Dashboard & app patterns

- **Page header:** title 24px/600, description ink-3, right: secondary "Docs" + primary "New automation" (Plus icon, ⌘N kbd).
- **Stat row:** 4 stat cards, 1px gap-less look is NOT used — normal 16px gaps.
- **Activity chart card:** area/bar of runs per day, success = ink-2 bars with failed overlay in #B42318 at 100%, hover tooltip; range segmented tabs (7d / 30d / 90d). Uses dataviz tokens: ≤2 hues + neutral.
- **Automations table card** with search, status filter, toggle column, last-run badge, overflow menu. Failed rows: tinted #FEF3F2 at 40% + sentence + "View step" link.
- **Right rail (≥xl):** "Needs attention" list (failed/suspended), "Getting started" checklist with progress.
- **Run detail drawer** (History): 480px sheet from right; header with status + run ID (mono) + Retry/Copy; vertical **step timeline** (dot per step on a 1px rail; dot = status icon; step title, duration in mono, collapsible input/output in a code well); failure step expands with human sentence + "Retry from this step".
- **History table:** sticky header, filters row (status multiselect, automation select, date range), pagination footer ("1–25 of 1,284" + prev/next), 90-day note in footer caption.
- **Builder:** three zones. Left: step library (search, grouped triggers/actions, drag-to-canvas is canvas-pan only; order from sortingOrder). Center: dotted canvas with node cards 280px (icon chip, title, subtitle, status), connectors = 1.5px ink-4 curves with a "+" insert handle; zoom/fit controls bottom-left, minimap optional. Right: inspector panel 320px (tabs Setup / Test / Settings; field list; "Test step" secondary). Top bar: back, editable name, saved indicator ("Saved · 12:04"), Test (secondary), **Publish** (primary), overflow.

---

## 6. Icons, motion, micro-interactions

- **Lucide only.** 16px in UI, 20px in marketing tiles, stroke 1.75. Logo mark = custom bolt in a flame-500 8px-radius tile (brand only).
- **Motion tokens:** 120ms hover/focus · 200ms dialogs/drawers/accordions · 600ms page fade-in-up (8px) · 1.6s beam sweep on hero connector · 30s marquee loop · count-up 900ms.
- **React Bits-inspired accents (pick max one per section):** shiny text sweep on eyebrow badge, border-beam on hero workflow card, spotlight cards on bento, marquee for integrations, count-up for metrics.
- **All** animation is disabled under `prefers-reduced-motion: reduce` (instant states, marquee static, beam hidden).
- Micro: copy-URL → check + "Copied" toast; toggle flips instantly, rolls back + error toast on rejection; button press scale .98; table row hover reveals actions; skeleton shimmer 1.4s.

---

## 7. Loading / Empty / Error

- **Skeletons** mirror final layout on `sunken` with a slow shimmer. Table skeleton = 6 rows; stat skeleton = label + value bars; builder = dotted canvas with two ghost nodes.
- **Empty** = 40px icon chip (flame-50/flame-600), title, one sentence, single CTA, optional secondary link. Examples: no automations → "Create your first automation"; no runs → "Fire a test run" + "Runs are kept 90 days."
- **Error** = Lucide AlertTriangle chip, plain sentence, **Retry** button, "Contact support" link. No codes, no traces. Inline field errors per forms.

---

## 8. Responsive

Mobile-first. `<sm` single column; `sm–lg` two columns, sidebar becomes sheet + bottom tab bar; `≥lg` fixed sidebar, 4-col stats; `≥xl` right rail. History table scrolls horizontally with sticky first column. Builder on mobile: canvas full-bleed, library and inspector open as bottom sheets. Touch targets ≥ 44px.

---

## 9. Dark theme (reserved, ships after V1)

Tokens remap: paper #0C0A09, surface #171412, sunken #1F1B18, line #2B2622, ink #FAF8F5, ink-2 #D6D0C8, flame-500 unchanged, flame-600 → #FB923C for text. Same radii/borders. ThemeToggle present in UI from day one; light only in V1.

---

## 10. Freeze rule

This file is the only source of color, type, spacing, radii, depth and motion. Build components in shadcn form (Radix primitives + these tokens) and pull motion accents from React Bits only where §3/§6 allow. No new palettes, fonts, radii, or shadows. Anything not here needs a PR to this file first.

---

## Changelog v1 → v2
| Area | v1 | v2 |
|---|---|---|
| Brand | Indigo-600 everywhere | Warm paper + ink, single flame accent |
| Primary button | Indigo fill | Ink fill (accent only for one marketing CTA) |
| Font | Inter | Geist + Geist Mono |
| Radii | 14 / 12 | 12 / 8 / 6 |
| Depth | soft/soft-md/soft-lg | 1px ring first, xs, pop |
| Status badge | pill | 6px radius, ring |
| Landing | generic hero + 3 cards | Workflow-card hero, marquee, bento, steps, metrics, FAQ |
| Auth | single centered card | Split layout with product vignette |
| Dashboard | cards + table | Shell with workspace switcher, ⌘K, chart, right rail, run drawer |
| Motion | fade + float | Purposeful: beam, marquee, count-up, spotlight, all reduced-motion safe |
