# Smart Todo — Project Spec & Build Rules

> Thin rules + invariants for the agent. **Read `docs/00-map.md` first** (the AI primer: module map,
> flows, invariants, secrets). Full feature detail = `docs/04-features-spec.md`; the _why_ + traps =
> `docs/decisions.md`. The MiniServer platform rules in `../CLAUDE.md` also apply.

---

## 1. Product goal

A personal, intelligent todo list. The user creates tasks during the day, checks them off, and rates the
effort (easy / normal / tiring). At end of day, one button: the AI reads history + ratings and proposes a
**feasible** todo list for tomorrow, with a **reason** for each item.

The core value is NOT "generate random tasks" but **suggestion grounded in real personal context**: what
was done, what was left undone, delay level, emotion, and actual completion speed.

This is a **single-user** app (the owner). No login, multi-tenant, or authorization needed.

## 2. Design principles (must keep)

- **Notion-minimal**: lots of whitespace, thin borders, no heavy gradients/shadows, not colorful.
- **Low friction**: emotion rating is one tap and ONLY opens once a task is done (rating undone work is meaningless).
- **Transparent**: every AI suggestion carries a short `reason`, traceable back to real data.
- **Light, fast, maintainable**: prefer few dependencies; runs with `npm run dev`, no Docker needed.

## 3. Tech stack (do NOT change on your own)

- Next.js (App Router, TypeScript)
- Tailwind CSS + shadcn/ui for UI
- Prisma + SQLite (one `dev.db` file; no MySQL/Redis)
- AI: call the cloud API via a **server route handler** (`/app/api/suggest/route.ts`). Do NOT leak the API
  key to the client. Read the key from env `AI_API_KEY`.
- The AI suggestion MUST return **structured JSON** (see §6), not free prose.

## 4. Data model

> **Source of truth = `prisma/schema.prisma`** (do NOT duplicate it here — it drifts). The model has grown well
> beyond the original `Task`/`DailyNote` (now also `Plan`/`Milestone`, `Goal`, schedule models, `Habit`, MCP
> additions — see §10–17 / `docs/04-features-spec.md`). Core invariants:

- **Nothing derivable is stored.** "Delay level" = days between `createdAt`/`carriedFrom` and today for undone
  tasks; `progress`/`behindDays`/`difficulty`/`capacity`/`streak` are all computed DYNAMICALLY (in `lib/*`), never
  columns. Avoids stale data.
- A **split task** = a child `Task` (`parentId`); the parent is a container, NOT counted in stats/streak.
- Task `date` = `"YYYY-MM-DD"` (the day it's attached to); `emotion` ∈ `love|meh|hard|null`.

## 5. Screens

1. **Today** (`/`):
   - Today's task list: round checkbox, title, 3 emotion buttons (locked until done), delete button.
   - A task not done & delayed ≥2 days shows a "delayed Nd" warning badge.
   - Add-task input (Enter to add).
   - 3 stat cards: Done (x/y), Rate %, Remaining.
   - "How was your day?" textarea (optional) → saved to DailyNote.
   - "Suggest todos for tomorrow" button.

2. **Suggest tomorrow** (modal or `/tomorrow`):
   - Show the AI JSON result: `carry_over` and `suggested_tasks` groups, each item with a priority badge + `reason`.
   - Show `capacity_note`.
   - Each suggestion has an **"Add to tomorrow"** button → creates a Task with `date` = tomorrow.

## 6. AI contract (most important)

`/api/suggest` receives context and calls the model. The **system prompt** must teach the model these principles:

- Calibrate to **actual speed**, not wishes. If recently ~N tasks/day get done, suggest around N (±1) — do
  NOT overload then leave things unfinished.
- **Carry over** important unfinished work, raise its priority if delayed for many days; suggest splitting it if too large.
- **Use momentum**: a new task related to one just finished (especially emotion="love") should follow on.
- **Lower the bar** for often-slipped tasks: suggest a smaller version so it's easy to finish (keep the streak).
- Put **heavy work early in the day**, light work to fill the gaps.
- ABSOLUTELY do not fabricate tasks unrelated to the data. Every `reason` must trace back to the input.

The model MUST return **exactly this JSON, with no other text/markdown**:

```json
{
  "capacity_note": "string — why this number of tasks, based on actual speed",
  "carry_over": [
    {
      "title": "string",
      "priority": "high|medium|low",
      "reason": "short string"
    }
  ],
  "suggested_tasks": [
    {
      "title": "string",
      "priority": "high|medium|low",
      "reason": "short string"
    }
  ]
}
```

The server must: force JSON format (use response_format/JSON mode if the API supports it), `try/catch` the
parse, strip ```json fences if present, and return a clear error if parsing fails.

Input sent to the model (the server assembles it from the DB):

- Tasks done today (with emotion).
- Tasks still undone (with delay days).
- Today's completion rate + the ~7-day average if available.
- Today's DailyNote (if any).

## 7. Code quality

- TypeScript strict. No `any` unless required and annotated.
- Separate logic: `lib/db.ts` (Prisma client singleton), `lib/ai.ts` (call model + parse), `lib/dates.ts` (date helpers).
- Use shadcn components; keep a neutral palette, thin `border`, medium radius.
- Do NOT use localStorage for real data — everything through Prisma/SQLite.
- Keep a `.env.example` listing `AI_API_KEY=` and `AI_MODEL=`.
- Short README: install, `npx prisma migrate dev`, `npm run dev`.

## 8. Build order (follow in sequence, commit each step)

1. Init Next.js + Tailwind + shadcn, set up Prisma + SQLite, run the first migrate.
2. Task CRUD + the "Today" screen (no AI yet). Ensure add/done/rate-emotion/delete work.
3. DailyNote + 3 stat cards + delay badge.
4. `lib/ai.ts` + the `/api/suggest` route with the §6 system prompt, returning the exact JSON schema.
5. The "Suggest tomorrow" screen + "Add to tomorrow" button.
6. Polish the UI to the Notion spirit, write README + .env.example.

## 9. When unsure

Ask one short question before deciding things that affect architecture. Don't add heavy dependencies
(auth, state manager, a different ORM) without confirming.

---

> **§10–§17 = feature specs.** Full detail is extracted to **`docs/04-features-spec.md`** (read it when you
> touch that feature). Below is ONLY the summary + **invariants** that must not be violated. §16 (tab roles)
> stays here in full because it's the naming/MCP-mapping source of truth, applied frequently.

## 10. Plan — long-term goals

> **Detail: `docs/04-features-spec.md` §10.** Summary + invariants:

- **Rolling roadmap**: the AI generates milestones at creation; daily tasks drip 1–2/day by roadmap position
  - real pace — **NOT a 30-day prefill**. Folded into `/api/suggest` (the `plan_tasks` group), no separate
    flow. Multiple parallel plans → split capacity evenly by `avgDonePerDay`.
- **Progress is DYNAMIC** (`lib/plan.ts`; no stored `progress`/`behindDays`). Models `Plan`+`Milestone`;
  Task only adds `planId?`/`milestoneId?`.
- **Invariants (§10.8):** capacity = real `avgDonePerDay` (intensity is only a soft hint); **the user ticks
  milestones** (the AI only suggests); **creating a plan does NOT spawn tasks**. Behind schedule → warn +
  offer choices, never silently rescale.

## 11. Behavioral layer — INVARIANT

> **Detail: `docs/04-features-spec.md` §11.** Central principle (do NOT violate):

- The app optimizes for **long-term adherence without burnout** — NOT for task-count. Every new mechanic
  passes 3 gates: low friction (input optional/1-tap) · transparency (reason ← real data) · ethics (regret test).
- **DO:** calibrate to actuals; learn difficulty from emotion → split often-slipped tasks; optional if-then
  cues; self-compassion; loss-soft streak (1-day grace); 80/20 + 1 MIT; goal-gradient; reward = informative feedback.
- **DON'T:** XP/level/badge/points tied to completion, variable reward, punishment, anxiety-push
  (_overjustification_ d≈−0.34). Difficulty/capacity are computed DYNAMICALLY (`lib/difficulty.ts`/`lib/capacity.ts`);
  a split task = subtask (`parentId`), the parent is a container — NOT counted in stats/streak.

---

## 12. UI shell & layout conventions — MANDATORY

> **Full detail: `docs/04-features-spec.md` §12.** `todo`'s OWN convention layer, ON TOP OF the shared
> `/react-ui-craft` standard (see `../CLAUDE.md`). Where they overlap, §12 wins (more specific); otherwise follow
> react-ui-craft. Summary + the invariants that must not be violated:

- **App-shell** (`components/app-shell.tsx`, rendered in `layout.tsx`) — NOT horizontal nav. Desktop ≥`lg`:
  collapsible left sidebar (7 items / 3 groups) + streak chip + theme. Mobile <`lg`: thin top-bar + 5-item bottom
  tab bar (NO hamburger). Notion-neutral, low-overwhelm (NN/g, Refactoring UI).
- **Width (INVARIANT, locked 2026-06):** the shell owns width + px — auto-centers **`max-w-5xl`** for EVERY page.
  **Pages NEVER set their own `<main>`/`max-w`/`mx-auto`/`px`**; they render `<div className="py-8">` only.
- **Shared primitives = MANDATORY reuse, don't hand-roll:** `page-header.tsx`, `empty-state.tsx`, `field.tsx`,
  `info-hint.tsx`/`icon-tooltip.tsx`, `ui/date-picker.tsx` + `ui/time-picker.tsx` (NO raw `<input type="date"/"time">`),
  `skeletons.tsx` + per-route `loading.tsx`.
- **Card set (INVARIANT, kills misalignment):** raised block = `rounded-lg border border-border/70 p-4` (no `<Card>`
  ring, no scattered `rounded-xl`/`p-6`/`border-input`); list row = `flex items-center gap-3 border-b border-border/70
  py-3 last:border-b-0`; sections `space-y-10`; page opens `py-8`.
- **Color (INVARIANT, 2026-06-14):** neutral base + semantic CSS tokens `--ok`/`--warn`/`--alert`/`--free` (use
  `text-warn` etc., NEVER per-file `text-amber-*`/`emerald-*`). ONE indigo accent (`--accent-brand`) only on focus
  ring + `link` variant; primary action stays neutral. No gradients. (`app/globals.css`; `docs/decisions.md` 2026-06-14.)
- **Motion = Motion v12** (`motion/react`); framer-motion ban LIFTED (2026-06). Restraint: animate only
  `transform`/`opacity`, keep `"use client"` boundary small, ALWAYS respect `prefers-reduced-motion`.
- **iPhone safe-area (INVARIANT, locked 2026-06):** `viewportFit: "cover"`; bars use `env(safe-area-inset-*)`;
  tap target ≥ ~44px. Sheet (not long modal) for reference flows; NO breadcrumbs.

---

## 13. Smart Discord notifications

> **Detail: `docs/04-features-spec.md` §13.** Invariant (§11): notifications **support, don't pressure, don't
> cause anxiety**. CODE computes the real numbers; the AI only writes the **voice** (it never fabricates).

- One-way Discord webhook (`lib/notify/discord.ts`). Internal cron `instrumentation.ts` → `lib/notify/scheduler.ts`
  (node-cron, ticks every minute). Fallback endpoint `/api/notify/run` guarded by `NOTIFY_SECRET`.
- 5 kinds (each with its own toggle + time): **morning · streak_guard · random_nudge · evening · queue_nudge** (§17).
  There's a **quiet-hours** window. `runNotification(kind,{force})` (`lib/notify/run.ts`) never throws; on AI
  failure it falls back to static copy.

## 14. Schedule → capacity-based Day Planner

> **Detail: `docs/04-features-spec.md` §14.** NOT Google Calendar — it's a **context + slotting layer**.

- The calendar is NOT a Task: it's **not** counted in streak/stats/completion. The AI only _suggests_ slots;
  the **server recomputes + validates** (discarding slots that overlap a hard commitment — trust boundary).
- Models (computed DYNAMICALLY in `lib/schedule.ts`): `Commitment` (weekly-recurring hard schedule + semester
  window + odd/even week) · `SoftBlock` (movable soft block) · `ScheduleEvent` (one-off) · `ScheduleSettings`
  (waking hours/buffer/minSlot). `computeFreeSlots` → free slots + `suggestedCapacityMin`. Tasks learn
  `estimatedMinutes`/`deepWork`/`actualBucket`; habits (`Habit`/`HabitCheck`) are isolated from tasks. Integrated
  into `/api/suggest` (slotStart/estimate/deepWork).

## 15. MCP Server (Claude reads/writes real data)

> **Detail: `docs/04-features-spec.md` §15.** INVARIANT: **AI logic is on Claude's side, not the server** — the
> server only CRUDs + serves context. Single-user; auth = bearer `MCP_AUTH_TOKEN` (+ an OAuth shim for claude.ai).

- Runs IN the Next app: route `app/api/[transport]/route.ts` (`mcp-handler`, Streamable HTTP stateless),
  endpoint `…/api/mcp`. Same process → shares `lib/db` + `lib/*`; one process writes SQLite.
- **MANDATORY sync rules** (`lib/mcp/repository.ts`, because the app filters by `done`/`date`, not `status`):
  set `scheduledFor` ⇒ set local `date`; `status=DONE` ⇒ `done=true`; `delete_task` = HARD delete; lenient date
  contract (accepts both `YYYY-MM-DD` and ISO). ⚠️ `Project` is **removed from MCP** → use **Plan**.
- Tools/Resources/Prompts in `lib/mcp/server.ts` (task · plan/milestone · habit · queue §17). Prompts force the
  flow: read context → present → **wait for approval** → only then write; respect `suggestedFreeMinutes`.

---

## 16. Tab roles — naming & teaching MCP/AI (INVARIANT, locked 2026-06)

> Each tab has **one** role + **one** name. No invisible concepts, no duplicate names. This is the source of
> truth for (a) UI labels, (b) writing MCP tool/prompt descriptions so the AI maps correctly. Origin: the AI
> created "plans" via MCP but the data scattered across both History and Plans, and `Project` (MCP) was invisible.

| Tab                   | Route                      | SOLE role                                                                                                                                                     |
| --------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Today                 | `/`                        | **In-day** execution: today's tasks, focus, suggest-tomorrow.                                                                                                 |
| Weekly calendar       | `/schedule`                | **Weekly HARD schedule** (study/work) + focus blocks → real free time. NOT todos.                                                                             |
| **Plans**             | `/plans`                   | **LONG-TERM GOALS**: roadmap + milestones + progress (`Plan`/`Milestone`). The ONLY place meaning "plan"; one plan's overview at `/plans/[id]`.               |
| **Incubating**        | `/incubating`              | **UNCOMMITTED GOALS** (Someday/Maybe — `Goal`): pressure-free capture. Exits: drag to a Task / promote to a Plan / drop. The ONLY place meaning "incubating". |
| Routines              | `/routines`                | Recurring habits + waking/sleep hours + time budget.                                                                                                          |
| History               | `/history`                 | **Looking back**: past days, streak, rate + "upcoming". Do NOT use the word "plan" here.                                                                      |
| Notifications / Guide | `/notifications`, `/guide` | System.                                                                                                                                                       |

**Naming rules (MANDATORY):**

- "Plan" = **only** the `/plans` page (long-term goals). No other page uses the word (History says "upcoming",
  not "upcoming plans").
- "Task" = the daily unit (has `date`/`scheduledFor`) → Today/History. "Calendar" = `Commitment`/`SoftBlock`
  weekly-recurring (NOT a task) → Weekly calendar.
- "Incubating" = **only** the `/incubating` page (goals NOT yet committed — no date, no roadmap). No other page
  uses the word. Incubating ≠ "Plan" (has a roadmap) and ≠ "Task" (has a date).

**MCP/AI mapping (so it doesn't misunderstand):**

- A multi-step / long-term goal → **Plan** (`create_plan` + milestones). There is no Project (removed, §15).
- A single day's work → `create_task`/`bulk_create_tasks` (a specific date). Hard schedule → `get_schedule` (read
  context, don't create tasks). Creating a Plan does **NOT** spawn tasks (§10.8) — tasks drip in rolling.
- A goal the user WANTS but has NOT committed _when_ / isn't sure task-or-plan → **Incubating** (`add_to_queue`).
  When ready: `promote_to_task` (a small task) or `promote_to_plan` (a multi-step goal). Never auto-drop.

---

## 17. Incubating — the uncommitted-goal queue (Someday/Maybe)

> **Detail: `docs/04-features-spec.md` §17.** A pre-commitment layer (GTD Someday/Maybe). Route `/incubating`,
> model `Goal`, logic `lib/queue.ts`. Different from `Task` (has a date) and `Plan` (has a roadmap).

- `Goal` (`title`, `note?`, `status`, `pinned`, `snoozedUntil?`, `promotedTaskId?`/`promotedPlanId?`) — has NO
  `date`, **isolated** from streak/stats. Computed DYNAMICALLY: `goalAgeDays`/`isStale`/`rankGoalsForNudge`.
- One-tap capture (`title` only). **3 exits:** drag to a Task / promote to a Plan / drop (soft, recoverable).
  **The AI only suggests, the user decides** — no auto-promote/auto-drop.
- "Remind me when free" is integrated (no separate flow): `/api/suggest` `queue_pulls` group · Today
  `incubating-nudge` card · Discord `queue_nudge` (§13). MCP (§15): `add_to_queue`/`list_queue`/`update_goal`/
  `drop_goal`/`promote_to_task`/`promote_to_plan`.
