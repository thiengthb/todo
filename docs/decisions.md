# Knowledge log — Smart Todo

> Architecture decisions + pitfalls + the _why_, recorded so the next session doesn't re-derive them or
> repeat mistakes. Append-only, **newest on top**. Standard: `nuc-platform/05-documentation-standard.md §5`.
> Record only the non-obvious (what code/git doesn't say on its own). Maintained by `/session-wrap`.

---

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
  (negligible on local SQLite, not worth the client coupling); **deferred** keyboard a11y for the pointer-drag
  schedule grid (a sizable, risky change to a working widget — own pass). Schedule kind colors (sky/violet) stay
  a **categorical** palette, NOT semantic tokens (wrong axis) — a legend under the grid covers discoverability.
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
