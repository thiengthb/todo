# Knowledge log — Smart Todo

> Architecture decisions + pitfalls + the _why_, recorded so the next session doesn't re-derive them or
> repeat mistakes. Append-only, **newest on top**. Standard: `nuc-platform/05-documentation-standard.md §5`.
> Record only the non-obvious (what code/git doesn't say on its own). Maintained by `/session-wrap`.

---

## 2026-06-20 — CLAUDE.md must not duplicate the Prisma schema (drift) + §12 extracted to spec

- **Context:** an audit found `todo/CLAUDE.md` at 335 lines (over the thin-CLAUDE.md budget). §12 (UI-shell
  conventions, ~64 lines) was kept inline, and §4 had a **hand-copied Prisma schema showing 2 models** while
  `prisma/schema.prisma` had grown to **16** — silent, stale drift.
- **Decision / Pitfall:** **never duplicate `schema.prisma` (or any generated/source-of-truth artifact) inside
  CLAUDE.md** — point to it instead and keep only the invariants (dynamic-compute, split-task container, date/emotion
  shape). Moved §12's full detail to `docs/04-features-spec.md §12` (inserted in order 11→12→13), leaving a thin
  summary+invariants+pointer. Result: 335→274 lines.
- **Why:** a copy in an auto-loaded file both costs context every turn AND rots independently of the real schema, so
  the agent reads a false model. The tiered-docs model already says "thin CLAUDE.md, heavy spec in docs/" — §4 was the
  one place that violated it by copying rather than pointing. (Did NOT push below 200: §6 AI-contract JSON and §16
  tab-roles table are load-bearing invariants — fragmenting them to hit a number would hurt legibility.)
- **Related:** `todo/CLAUDE.md` §4/§12; `docs/04-features-spec.md §12`; `nuc-platform/06-knowledge-ledger.md §A`
  (2026-06-12 "CLAUDE.md thin"); `05-documentation-standard.md §2`; PR `todo#1`.

## 2026-06-14 — `.design-sync/` mirror for Claude Design (claude.ai/design)

- **Context:** wanted to view/iterate `todo`'s shadcn/ui primitives inside Claude Design. Claude Design renders
  **static HTML preview cards, NOT live React/TSX** — so the app can't be pointed at directly.
- **Decision:** keep a hand-authored mirror in **`.design-sync/components/*.html`** (22 cards = the full
  `components/ui/` set), each a self-contained light|dark split pane with **OKLCH tokens copied verbatim from
  `app/globals.css`**. Dot-prefixed dir → ignored by Next file-routing, never part of the build (it's purely a
  sync source). Synced to the shared **"Design System"** project via the **DesignSync tool**, namespaced under
  `todo/` so sibling apps can sync alongside without path collisions.
- **Pitfall / maintenance:** this is a **manual mirror — it drifts.** When a component variant or a token changes
  in the app, update the matching card in the SAME change, or the design system lies. Composite cards
  (`date-picker`/`time-picker`) + calendar use a **fixed sample month (June 2026)** to illustrate states, not a
  live date. A few icons are emoji/glyph placeholders (`▦ 🕐 🗑 ✕ ‹ ›`) — a known lossy spot; upgrade to lucide
  inline SVG if fidelity matters.
- **Pitfall — `/design-sync` skill is NOT installed here**, only the raw DesignSync tool. The skill's self-check
  is what compiles the `@dsCard` markers into the index; without it, **upload alone shows an empty pane** — you
  must call **`register_assets`** explicitly (planId from `finalize_plan`, every asset path must be in that plan's
  `writes`; `finalize_plan` requires both `writes` and `deletes`, deletes can be `[]`). All 22 were registered
  (`registered: 22`).
- **UNVERIFIED (resume here):** I confirmed upload + registration but NOT that the cards visibly render in the
  pane — the user paused before refreshing claude.ai/design to check. Next session: confirm they appear; if still
  empty, fetch one registered card and/or author a `_ds_manifest.json` manually. Open follow-ups: lucide-icon
  fidelity upgrade; an optional "Design tokens" palette card. Detail: `.design-sync/README.md`.

## 2026-06-14 — UI/UX renovation (Phase 0–5; see `docs/plans/2026-06-14-ui-renovation.md`)

- **§12 "no brand accent" is LIFTED → one restrained indigo `--accent-brand` + semantic color tokens
  (`--ok`/`--warn`/`--alert`/`--free`).** Tokens live in `app/globals.css` (`:root`+`.dark`, OKLCH) and are
  exposed as Tailwind utilities via `@theme inline` (`--color-*`), so `text-warn`/`bg-warn/10` work. Indigo hue
  **273** was chosen to stay distinct from the schedule's categorical sky(học)/violet(làm). Accent is applied
  ONLY to the global focus ring (`--ring: var(--accent-brand)`) + the button `link` variant — primary buttons
  stay neutral black/white. **Why:** pure-neutral hurt scannability (behind/overdue/done all read the same) and
  the "behind" amber was hardcoded in ≥5 files; a token kills the duplication and a single restrained accent adds
  life without breaking Notion-minimal. **Don't** re-introduce per-file `text-amber-*`/`text-emerald-*` for
  semantic state — use the tokens. Related: `components/ui/progress-{ring,bar}.tsx`.
- **All progress donuts/bars go through `components/ui/progress-ring.tsx` + `progress-bar.tsx` (a11y built in:
  `role="progressbar"`+aria-valuenow).** Retired 3 ad-hoc conic-gradient rings (stats-cards/plan-momentum/
  plan-card) that were aria-invisible. `ProgressBar` takes an optional `expected` (0–100) → a vertical tick;
  `computePlanProgress` now returns `expectedFraction` so the plan bar shows _time-elapsed vs work-done_ at a
  glance (not just a "chậm Nd" badge). **Don't** hand-roll inline rings again.
- **Pitfall — bounding the History query would corrupt the streak.** `app/history` now fetches only the last
  `HISTORY_WINDOW_DAYS=180` (with a narrow `select`) to stay cheap, BUT `computeStreaks` is fed the **full**
  done-date set from `getActiveDoneDates()` (`lib/streaks-query.ts`), NOT the windowed `days`. Computing the
  streak from a windowed list would silently cap `longest`. Keep these two data sources separate.
- **Request-`cache()` to dedupe identical first-party queries in one render.** `getActiveDoneDates` (layout
  streak-chip + Today + History) and `getScheduleSettings` (Today + Schedule + suggest route) are wrapped in
  React `cache()` → one DB round-trip per request instead of N. `Task` gained `@@index([date])`/`([done,date])`/
  `([parentId])` (the most-queried table previously had none).
- **Two bugs fixed that the types couldn't catch:** (1) `/schedule` computed per-day `freeMin` and **never
  rendered it** — now a `~Xh` line in each column header; (2) habit CRUD `revalidate()` hit `/` + `/schedule`
  but **not `/routines`** (the actual management page) → stale list; fixed (and dropped the useless `/schedule`).
- **Deliberate non-changes (don't "fix" these later):** kept native `<details>` for History streak-runs (zero-JS
  accessible disclosure beats a hydrated Collapsible on a server page); used lightweight first-party **type
  guards** instead of client-side Zod at the `/api/suggest`+`/api/plan/decompose` boundaries (avoids bundling Zod
  to re-check our OWN server); did NOT fully eliminate the `setEmotion`/`scheduleTaskAt` read-before-write
  (negligible on local SQLite, not worth the client coupling). Schedule kind colors (sky/violet) stay
  a **categorical** palette, NOT semantic tokens (wrong axis) — a legend under the grid covers discoverability.
- **Keyboard a11y for the pointer-drag schedule grid — reuse the dialog, don't rebuild drag.** Blocks became
  `role="button"`+`tabIndex=0`+`aria-label`, Enter/Space opens the editor; create stays on the "Thêm lịch" button,
  move/resize happen by editing day/time in that dialog. **Why:** full keyboard drag-create/move/resize on a
  Pointer-Events widget is large + risky for little gain when the dialogs already give complete CRUD. Keep the two
  input paths separate — keyboard via `onKeyDown`, pointer via the delegated `finish()` — so neither double-fires
  (don't add `onClick` to a timed block, or a mouse tap fires both). `week-grid.tsx`.
- **Process note:** the screen-by-screen audit that scoped this was fanned out to **Sonnet subagents under Opus
  review** (4 parallel read-only explorers → structured reports). Cheap, isolated, and the synthesis stayed on
  Opus — a good template for the next big multi-screen audit.

---

## 2026-06-13 — Foundational design decisions (seeded from the established spec)

This log was started when todo's spec moved out of `CLAUDE.md` into the doc-set. Dates below are when
recorded, not necessarily when first decided. The non-obvious *why*s behind the existing design:

- **Optimize long-term adherence, not task-count (the deepest invariant).** Every mechanic passes 3 gates —
  low-friction · transparent · ethical (regret test). Explicitly NO XP/level/badge/points-on-completion,
  variable reward, punishment, or anxiety-push notifications. **Why:** extrinsic reward on already-intrinsic
  behavior backfires (overjustification effect, d≈−0.34); the evidence-backed DO/DON'T list lives in
  `04-features-spec.md §11`. New features must not violate this.
- **Dynamic compute over stored columns.** delay, streak, progress, behind-days, difficulty, capacity,
  free-minutes are computed on read (`lib/{plan,difficulty,capacity,velocity,streak,schedule}.ts`), never
  persisted. **Why:** a stored derived value goes stale the moment its source changes; recompute is cheap and
  always correct. (Platform-wide lesson — see `nuc-platform/06-knowledge-ledger.md`.)
- **Plan = rolling roadmap, never a 30-day prefill.** A plan stores milestones; daily tasks are dripped 1–2
  at a time through `/api/suggest` from roadmap position + real pace. **Why:** pre-generating 30 days means any
  slip becomes a pile of overdue tasks — the opposite of the feasibility goal. Creating a plan does NOT spawn
  tasks; the user ticks milestones (the AI only suggests).
- **MCP runs in-process; AI logic lives on Claude's side — the server only CRUDs + serves context.**
  `app/api/[transport]` shares `lib/db` + helpers; one process writes SQLite. The sync rules in
  `lib/mcp/repository.ts` exist because the app filters by `done`/`date`, NOT `status`: set `scheduledFor` ⇒
  set local `date`; `status=DONE` ⇒ `done=true`+`completedAt`; `delete_task` = **HARD delete** (a soft
  CANCELLED task would leak into the UI). `Project` was removed from MCP — long-term goals route to `Plan`.
- **Stateless OAuth shim for claude.ai web.** code/access/refresh are HMAC-signed JWTs (`lib/mcp/oauth.ts`,
  no DB table); PKCE S256 required; consent gate = the owner enters `MCP_AUTH_TOKEN`. **Why:** claude.ai web
  only supports OAuth (no pasted bearer), and a stateless shim avoids a session table. ⚠️ Known Anthropic bug
  (2026-06): claude.ai web sometimes completes OAuth but doesn't attach the bearer (401 loop) — the server is
  spec-correct; fall back to Desktop/Cursor if hit.
- **Schedule is a context layer, and the AI's slots are a suggestion the server re-validates.**
  `lib/schedule.computeFreeSlots` recomputes free time server-side and discards any AI-proposed slot that
  collides with a hard commitment (trust boundary). Calendar entries are NOT Tasks → never counted in
  streak/stats/completion.
- **Tab roles + naming are a single source of truth (`CLAUDE.md §16`).** Each tab has ONE role + ONE name
  ("Kế hoạch" = `/plans` only, "Ấp ủ" = `/incubating` only, "Việc" = a dated task, "Lịch" = a weekly
  commitment). **Why:** AI-via-MCP was scattering "plans" across History and Plans, and `Project` was
  invisible — so the naming was pinned and MCP tool descriptions map onto it.

**Meta:** `CLAUDE.md` was slimmed (463→327) by extracting the feature spec to `04-features-spec.md`; this
session added `00-map.md` + this log and translated `CLAUDE.md` to English — completing the Knowledge OS
doc-set for the reference web-app (plan `docs/plans/2026-06-13-claude-md-to-knowledge-os.md`).

---

_(Add new decisions/pitfalls above this line, newest on top.)_
