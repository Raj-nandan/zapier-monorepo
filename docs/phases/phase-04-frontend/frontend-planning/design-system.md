# Zapier-Monorepo Frontend — Design System

> **Document:** `docs/phase-04-frontend-planning/design-system.md`
> **Status:** DRAFT
> **Purpose:** The single visual truth for V1. Light theme. Every screen composes these tokens and systems — nothing else. Values are copied verbatim from the legacy `tailwind.config.ts` so the rebuild keeps its identity.

## 1. Tokens

**Colors — brand (indigo):** `50 #eef2ff · 100 #e0e7ff · 200 #c7d2fe · 300 #a5b4fc · 400 #818cf8 · 500 #6366f1 · 600 #4f46e5 (primary) · 700 #4338ca (hover) · 800 #3730a3 · 900 #312e81`.
**Colors — neutral (slate, text/surfaces/borders):** `50 #f8fafc (page) · 100 #f1f5f9 · 200 #e2e8f0 (borders) · 300 #cbd5e1 · 400 #94a3b8 (placeholders) · 500 #64748b (secondary text) · 600 #475569 · 700 #334155 · 800 #1e293b · 900 #0f172a (headings)`.
Body text `neutral-600/500`, headings `neutral-900`, page `neutral-50`, cards white.

**Type (Inter, `next/font/google`):** `display-lg 2.5rem/1.2 · display 2rem/1.25 · display-sm 1.5rem/1.3 · title 1.25rem/1.4 · title-sm 1.125rem/1.4 · body 0.9375rem/1.5 · body-sm 0.8125rem/1.5 · caption 0.75rem/1.4`. Headings weight 600. Never set a font-size outside this scale.

**Spacing:** Tailwind scale + `18: 4.5rem · 22: 5.5rem · 30: 7.5rem`. Page gutters: `container-content` (max `content-xl 72rem` marketing, `content-lg 56rem` auth, full-width dashboard with 2rem padding). Stack rhythm 4 / 6 / 8.

**Radii:** cards `3xl 0.875rem`, inputs/buttons `2xl 0.75rem`, pills full. **Depth:** `soft`, `soft-md`, `soft-lg`, hairline `border` shadow only — no other shadows.

## 2. Component Systems

**Buttons:** `primary` (brand-600 → brand-700 hover, white text, `lg` for CTAs like Create automation), `secondary` (white, neutral-200 border), `ghost` (nav/secondary), `danger` (red, destructive confirms only). Disabled = reduced opacity + `aria-disabled`; submitting shows spinner + “Publishing…”-style label, never a dead click.

**Forms:** labeled `Input` + inline error (icon + text, `aria-describedby`), Zod-first validation mirroring the API, password fields with show/hide, OAuth buttons full-width below the divider. “Forgot password?” is a text link beside the password label.

**Cards:** white, `3xl` radius, `soft` shadow; dashboard analytics cards pair a caption label + title value + muted delta. Tables live inside cards with a header row (title + actions).

**Status system (ZapRun/Step: `PENDING · RUNNING · SUCCESS · FAILED · SKIPPED · SUSPENDED`):** badge = Lucide icon + text label, never color-only: Pending `Clock` neutral, Running `Loader2` (spin, `aria-live`) brand, Success `CheckCircle2` green, Failed `XCircle` red, Skipped `MinusCircle` neutral, Suspended `PauseCircle` amber. Failed rows also carry text error + step link.

**Navigation:** marketing header (logo left, Log in + Create automation right) vs dashboard shell (top bar with search + ThemeToggle + avatar/Sign out; sidebar: Dashboard, Create, History, Connections/Settings). Active item = brand-600 text + brand-50 pill. Mobile: sidebar collapses to bottom nav / hamburger; dashboard cards stack; history table scrolls horizontally.

## 3. Icons, Motion, Micro-interactions

Lucide only (`Zap`, `Plus`, `Play`, `RotateCcw`, `Copy`, `Check`, `Search`, `Settings`, `LogOut`, `Sun/Moon`, status icons above). No emoji as iconography.
Motion: `fast 150ms` (hover/focus), `normal 200ms` (dialogs/drawers), `fade-in-up 0.6s` page entry, `float 6s` hero accent only. All animation gated behind `prefers-reduced-motion: reduce` (instant state changes). Micro-interactions: copy-URL → check + “Copied” toast; toggle flips instantly, rolls back with error toast on rejection; builder node drag is canvas-pan only (order comes from `sortingOrder`, not drag order).

## 4. Loading / Empty / Error

Skeletons mirror final layout (`TableSkeleton` for tables, card shimmer for analytics, canvas placeholder for builder). Empty states pair icon + sentence + CTA (e.g. no automations → Create automation; no runs → fire/test + 90-day note). Errors pair icon + human sentence + Retry (see `content.md`); no codes, no traces.

## 5. Responsive

Mobile-first dashboard and builder (single column, full-width sheets); desktop-dense history table (sticky header, truncated cells with tooltips, min column widths). Breakpoint behavior: `<sm` stacked, `sm–lg` two-column cards, `≥lg` sidebar + multi-column analytics.

## 6. Freeze Rule

This file is the only source of color, type, spacing, radii, depth, and motion. Reuse legacy `Button/Input/Card/Modal/WorkflowNode/EmptyState/Skeleton` patterns in shadcn form; do not introduce new palettes, fonts, or radii.

---

**Status:** DRAFT
**Freeze rule:** Colors, type, and spacing come from the tokens above only. No new visual language without a PRD update.
