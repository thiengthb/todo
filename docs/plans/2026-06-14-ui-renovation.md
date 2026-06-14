---
title: UI/UX renovation — indigo accent + semantic tokens, data-viz, IA re-layer, backend perf
status: done # draft → active → done | abandoned
created: 2026-06-14
updated: 2026-06-14 # Phase 0-5 done & verified (lint/tsc/build/audit clean). Open tails: 4.6 keyboard-grid (deferred future work) · 5.5 live click-through (post-deploy). Knowledge distilled → decisions.md + ledger.
related:
  [
    CLAUDE.md §12,
    app/globals.css,
    components/today/,
    components/plans/,
    app/history/page.tsx,
    components/schedule/week-grid.tsx,
    prisma/schema.prisma,
    ../../nuc-platform/05-documentation-standard.md §5.5,
  ]
---

<!--
  Multi-session UI/UX renovation. Token-cheap; keep the checklist in sync as you execute.
  Standard: /react-ui-craft (7-step + quality floor) ON TOP of CLAUDE.md §12 (todo's own convention layer).
-->

## Goal

The todo app keeps its Notion-minimal calm but gains (a) a restrained **indigo** accent + a single semantic
color system, (b) real **data-viz** for progress/streak/schedule (today shown as plain text), (c) a clearer
**information hierarchy** on Today/Plans/History/Schedule, and (d) a measurably faster, leaner **data layer** —
with the quality floor (a11y, states, contrast, typed boundaries) raised across every touched screen.

## Context

App is technically solid (clean server/client split, queries already `Promise.all`'d) but visually flat:
3 progress-rings are foreground-only + a11y-blind, "behind/overdue" amber is hardcoded in ≥5 files, computed
metrics (`behindDays`, expected-vs-actual, velocity, per-day `freeMin`) are shown as text or **not at all**.
Two real bugs surfaced: `/schedule` computes `freeMin` then never renders it; habit CRUD doesn't revalidate
`/routines`. User chose: **Tái cấu trúc UX/IA** depth · **indigo** accent (must avoid amber/emerald/rose/sky/violet
which already carry meaning) · focus = Today+suggest, Plans+History, Schedule+Routines · **include backend perf**.

## Approach & tradeoffs

- **System before screens** (`/react-ui-craft` step ③): Phase 0 lands tokens + shared primitives so every later
  screen consumes them, not bespoke colors. Avoids re-touching files for color twice.
- **Backend (Phase 1) early & independent** — indexes/`cache()`/`select` are low-risk and give a fast base; can
  even ship alone.
- **Today layout = re-layer, NOT re-architect** (user's choice): keep the 2-col `lg:grid-cols-[minmax(0,1fr)_300px]`
  shell, regroup the right column into tiers + lift the suggest action; ruled out a full column re-flow (changes a
  familiar daily-use surface more than the value justifies).
- **Accent = indigo** as a new CSS var (`--accent-brand` / used for link/focus/primary nudge only), NOT a palette
  rewrite — keeps §12 Notion-minimal intact while unlocking "no brand accent". Semantic colors (`--ok` on-track/done,
  `--warn` behind/overdue, `--alert` tired, `--free`) become tokens so the 5-file amber duplication dies.
- Ruled out: charting libs (keep "few dependencies" §2) — rings/bars/heatmaps are CSS + tiny SVG; Motion v12 only
  for the one notable moment per screen.

## Steps

### Phase 0 — Design foundation (system layer)

- [x] 0.1 — indigo `--accent-brand` + semantic tokens (`--ok`/`--warn`/`--alert`/`--free`, OKLCH, dark+light) + `@theme inline` mappings · `app/globals.css`
- [x] 0.2 — `components/ui/progress-ring.tsx` (conic, `tone`, `role="progressbar"`+aria) + `progress-bar.tsx` (expected-position tick) · created
- [x] 0.3 — replaced 3 ad-hoc rings with the primitive (tone-by-pace folded in: warn when behind, ok at 100%) · stats-cards, plan-momentum, plan-card
- [x] 0.4 — amber "behind" → `--warn` token · plan-card, plans/[id], behind-alert, plan-momentum (history amber → handled in Phase 3 rework, NOT double-touched here)
- [x] 0.5 — indigo on focus rings globally (`--ring: var(--accent-brand)`) + button `link` variant; primary buttons stay neutral

### Phase 1 — Backend perf/data (low-risk, independent)

- [x] 1.1 — `@@index([date])`, `@@index([done, date])`, `@@index([parentId])` on `Task` (compound covers bare `done`) · migration `add_task_indexes` applied
- [x] 1.2 — dedup streak query via React `cache()` → `lib/streaks-query.ts:getActiveDoneDates`; wired into layout + Today (var renamed `activeDayRows`→`activeDoneDates`)
- [x] 1.3 — `getScheduleSettings` wrapped in `cache()`
- [x] 1.4 — History: `select` date/done/emotion/title + `date >= today-180d` bound (`HISTORY_WINDOW_DAYS`); streak now uses full `getActiveDoneDates` so longest stays correct; dailyNote also bounded+selected
- [x] 1.5 — `HabitCheck` include bounded to last 366d in Routines
- [x] 1.6 — **bug fixed:** habit `revalidate()` now hits `/routines` (and dropped the useless `/schedule`)
- [x] 1.7 — narrowed `setEmotion` read to `select:{done,emotion}` (kills over-fetch). Full read-ELIMINATION (`updateMany`+client-passed emotion; `scheduleTaskAt` date param) **intentionally NOT done**: on a local-SQLite singleton the saved round-trip is negligible and it would add client-caller coupling + risk the emotion-toggle semantics — not worth it (honest-critique call).

### Phase 2 — Today + suggest (re-layer, keep 2 cols)

- [x] 2.1 — right column tiered: status (Stats+Checkin) → action (Suggest) → secondary (PlanMomentum+Nudge) under a hairline divider · `app/page.tsx`
- [x] 2.2 — Suggest moved above the secondary tier → reachable after 2 cards on mobile (logical order: review today → plan tomorrow)
- [x] 2.3 — FocusBar: free-time is now the `text-sm font-medium` headline; overload → `text-warn`; `aria-current` on the active view toggle
- [x] 2.4 — NoteBox trigger icon `Plus`→`PenLine` + label "Viết ghi chú…" (no longer mimics the Add-task input); also fixed the stale "Đã lưu ✓" (resets on re-edit)
- [x] 2.5 — Suggest Sheet: renders `plan_alerts.options`; cue icon `Clock`→`MapPin` (time keeps Clock); "đã thêm" lifted to the sheet (survives regenerate); item-count summary; priority/recovery/alert colors → tokens
- [x] 2.6 — checkin-box: capacity label/bar → `--ok`/`--warn` tokens; the low-capacity _support_ line → calm `text-muted-foreground` (was emerald = clash; amber would read as pressure, §11)

### Phase 3 — Plans + History data-viz

- [x] 3.1 — `computePlanProgress` now returns `expectedFraction`; plan-detail bar = `ProgressBar` with the expected-position tick + a one-line legend when behind
- [x] 3.2 — ring/bar `tone` by pace (behind=`--warn`, 100%=`--ok`, else neutral) on plan-card + plan detail
- [x] 3.3 — `daysLeft` color: `text-warn` <7d active, `text-alert` overdue — on both plan-card and plan detail
- [x] 3.4 — `MilestoneTimeline`: dots positioned by `targetDate` (done=ok / overdue=warn / upcoming=neutral) + today marker, shown when ≥2 dated milestones; rows also mark overdue (circle + date → warn). `today` passed from server (no hydration drift)
- [x] 3.5 — 14-day strip → semantic heatmap (≥80 ok / 40-79 warn / <40 alert); no-data day = faint empty track (distinct from 0%); today = ring; `title`→`aria-label`
- [x] 3.6 — streak current-vs-longest = ONE card on a shared scale (`ProgressBar`, tone by atRisk) + "ở mức kỷ lục" note; flame amber→`--warn`. Kept native `<details>` for runs (zero-JS accessible disclosure — better than a hydrated Collapsible here)
- [x] 3.7 — pace ~done/active-day (7d) with a trend arrow vs 30d, in the activity-strip header
- [x] 3.8 — `DayRow`+`EmotionSummary` extracted to `components/history/day-row.tsx`; emotion now shows on mobile (below the bar) too; emotion icon colors → tokens

### Phase 4 — Schedule + Routines

- [x] 4.1 — **dead data fixed:** per-day `freeMin` rendered as a `~Xh` (free-tone) line in each column header (`d.freeMin` was already on DayColumn)
- [x] 4.2 — `PX_PER_MIN` 0.8→1.0 (shared with DayTimeline → both more legible); schedule `loading.tsx` skeleton bumped 480→720 to match
- [x] 4.3 — free-slot fill → `bg-free/20` (clearly visible vs today's muted bg) + a color/style **legend** under the grid (khe rảnh / cố định / linh hoạt / Học / Làm). Kind hues kept as a categorical palette (sky/violet) — NOT folded into semantic tokens (wrong axis); legend covers the discoverability gap
- [x] 4.4 — half-hour tick lines (`bg-border/20`, lighter than the whole-hour lines)
- [x] 4.5 — habit streak now shows a `--warn` Flame + count; settings form has a live "Cửa sổ thức ~Xh/ngày" preview that updates as wake/sleep/buffer change
- [x] 4.6 — keyboard a11y for the grid (done 2026-06-14, separate commit): timed blocks are now `role="button"` + `tabIndex=0` + `aria-label` (title/time/kind) + Enter/Space → open the editor; all-day chips got `aria-label` + `onClick` (were dead on tap). Did NOT build keyboard drag-create/move/resize — instead leaned on the EXISTING dialogs: create via the "Thêm lịch" button, move/resize by opening a block and changing day/time in the form. Full CRUD is keyboard-reachable; pointer-drag stays a mouse/touch enhancement (no double-fire: keyboard uses onKeyDown, pointer uses the delegated finish()). Hint text updated.

### Phase 5 — Quality-floor sweep + verify

- [x] 5.1 — boundary validation replacing blind `as` casts at `/api/suggest` + `/api/plan/decompose` — lightweight first-party guards (NOT Zod, to keep Zod out of these client bundles for re-checking our own server); throws a clear message + the existing error UI shows it
- [x] 5.2 — a11y: aria on rings/bars/charts done in-phase; checkin Scale + sleep buttons got `role="group"` + per-value `aria-label` + `aria-pressed`; 14-day bars use `aria-label` (3.5); EmotionSummary icons `aria-hidden` (3.8)
- [x] 5.3 — schedule `loading.tsx` 480→720 (PX bump); block time 9px→10px (taller blocks now fit); freeMin header → muted text + a free-tone dot (avoids a low-contrast teal-on-white label)
- [x] 5.4 — lint + tsc + build all clean; `npm audit` = 0 high/critical (2 moderate postcss via Next, pre-existing & transitive — not introduced here, fix = downgrade Next = breaking)
- [~] 5.5 — build is green (evidence). Live click-through (light/dark, ≤360px) NOT run in this session (no browser/DB here) → verify on `todo.thientnse.site` after deploy
- [x] 5.6 — `/session-wrap`: distilled into `docs/decisions.md` (2026-06-14 entry), `00-map §2` UI line, `CLAUDE.md §12` color invariant updated (accent lift), + 3 cross-project lines in `06-knowledge-ledger.md`

## Out of scope

- No palette rewrite / no gradients / no departure from Notion-minimal beyond the single indigo accent.
- No IA change to which tabs exist or their roles (§16 tab roles locked).
- No new heavy dependency (charting lib, state manager, animation lib beyond Motion v12).
- No change to the AI suggestion JSON contract (§6) or MCP tools.
- No multi-user / auth work.

## Open questions / risks

- **Risk:** indigo focus-ring vs sky "study" block could read similar at a glance — keep indigo darker/more saturated; verify side-by-side on `/schedule`.
- **Risk:** raising `PX_PER_MIN` lengthens the grid → recheck mobile scroll + `loading.tsx` skeleton height (5.3 covers it).
- **Open:** History bound window (last N months) — pick N after checking real row counts; default 6 months w/ "load more".

## Decisions to distill

Hand to `docs/decisions.md` via `/session-wrap` when done:

- §12 "no brand accent" is **lifted** → one restrained indigo accent (`--accent-brand`) for link/focus/primary nudge; buttons stay neutral. Semantic colors are now tokens (`--ok`/`--warn`/`--alert`/`--free`), not per-file hardcoded amber/emerald.
- Shared a11y primitive `ProgressRing`/`ProgressBar` is the ONLY way to draw progress (3 ad-hoc conic rings retired).
- `Task` table now indexed (date/done/parentId); streak query + schedule-settings are request-`cache()`d.
- Bugs fixed: `/schedule` `freeMin` was computed-but-unrendered; habit CRUD didn't revalidate `/routines`.
- Plan progress now shows expected-vs-actual position (the gap, not just a "chậm Nd" badge).
