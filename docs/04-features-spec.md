# Smart Todo — Advanced feature spec (detailed)

> Extracted from `CLAUDE.md` (2026-06-12) to keep `CLAUDE.md` thin (rules + invariants that load every
> session). **This is the FULL spec** for the 6 feature layers below — read it when you touch that feature.
> The core invariants are still summarized in `CLAUDE.md`; this file is the implementation detail.
>
> Contents: §10 Plan · §11 Behavioral layer · §13 Discord notifications · §14 Day Planner · §15 MCP Server ·
> §17 Incubating (Someday/Maybe). (§12 UI shell and §16 tab roles stay in `CLAUDE.md` as frequently-applied
> conventions/invariants.)

---

## 10. Plan feature

> Extends the app to **long-term goals** (e.g. "Learn basic Japanese in a month").
> Invariant philosophy: **track real pace, not wishes** — just like the suggest-tomorrow part.
> Do NOT build a "hard 30-day schedule" (pre-generate every task → any slip piles up overdue tasks, against the app).

### 10.1 Core mechanism — rolling roadmap

A plan splits into 2 tiers:

- **Roadmap (milestones)** — relatively stable: the goal + a few big milestones the AI generates at creation,
  the user can edit. E.g. Week 1 Hiragana → Week 2 Katakana → Week 3: 100 vocab → Week 4: simple sentences.
- **Daily tasks** — dynamic, rolling: the AI does NOT pre-generate 30 days. Each day it drips only the next
  1–2 tasks based on _where you are on the roadmap_ + _your real pace lately_ + _emotion_. Fast → push ahead;
  slow → shrink tasks / extend the deadline.

### 10.2 Integration — FOLDED into `/api/suggest`, no separate suggestion flow

A plan's tasks are just a 3rd suggestion type alongside `carry_over` and `suggested_tasks`. One "Suggest
tomorrow" button yields all 3 groups. A plan task's `reason` traces back to a **milestone** (not yesterday's work).

### 10.3 Multiple parallel plans — split capacity

Allow multiple `active` plans at once (e.g. Japanese + gym). The AI knows total capacity/day is limited
(= real `avgDonePerDay`) so it **splits evenly across plans**, no overloading. The total (carry_over +
suggested + plan_tasks) still ≈ `avgDonePerDay` (±1).

### 10.4 When behind schedule — warn + let the user choose

The AI detects lateness, says clearly "~N days behind", then offers 2–3 choices (extend the deadline / drop a
milestone / keep going & speed up) for the user to tap. **No silent rescaling** (keep it transparent).

### 10.5 Progress measurement — DYNAMIC, not stored (like `delay`, `streak`)

No `progress` column in the DB. Computed on the fly (in `lib/plan.ts`):

```
expectedMilestone = round( daysBetween(start, today) / daysBetween(start, end) × totalMilestones )
behindDays        = days derived from the gap between milestones actually done and the expected mark
progressPct       = milestones done / total milestones
```

### 10.6 Data model (Task barely changes)

```prisma
model Plan {
  id        String   @id @default(cuid())
  title     String
  goal      String   // definition of "done" + context
  startDate String   // "YYYY-MM-DD"
  endDate   String   // target date
  status    String   @default("active") // active | paused | done | archived
  intensity String   @default("vừa")    // light | normal | intense — a soft hint for the AI
  createdAt DateTime @default(now())
  milestones Milestone[]
  tasks      Task[]
}

model Milestone {
  id         String   @id @default(cuid())
  planId     String
  plan       Plan     @relation(fields: [planId], references: [id], onDelete: Cascade)
  title      String
  order      Int      // order in the roadmap
  targetDate String?
  done       Boolean  @default(false)
  tasks      Task[]
}

// Task only ADDS 2 optional columns + relation → streak/stats/emotion/delay run unchanged:
//   planId      String?
//   milestoneId String?
//   plan        Plan?      @relation(fields: [planId], references: [id])
//   milestone   Milestone? @relation(fields: [milestoneId], references: [id])
```

### 10.7 Two AI calls

- **Decompose** — new route `/api/plan/decompose`, runs only at plan creation. Input: `title`, `goal`,
  `durationDays`, `intensity`. Output JSON `{ milestones: [{ title, order, targetDate }] }`. THIS is where the
  AI MAY use general knowledge (standard curricula); each milestone is verifiable ("Memorize the Hiragana
  table"), not vague ("Study hard"). Logic + prompt live in `lib/ai.ts`.
- **Daily inject** — extends `/api/suggest`: `SuggestContext` adds `activePlans` (id, title, goal,
  currentMilestone, progressPct, behindDays); `RESPONSE_SCHEMA` adds `plan_tasks` (with `planId`,
  `milestoneId`) and `plan_alerts: [{ planId, behindDays, options: string[] }]`.

### 10.8 Settled conventions (defaults)

- **Capacity** comes from real `avgDonePerDay`; `intensity` is only a soft hint — do NOT require "minutes/day" input.
- **Milestone done**: the user ticks it on the detail page; the AI may only _suggest_, NOT auto-tick.
- **Creating a plan does NOT auto-generate today's tasks** — they only drip in via "Suggest tomorrow".

### 10.9 Screens

1. Nav adds **"Kế hoạch"** (Plans) → plan list (card: progress % ring, current milestone, "behind Nd" badge).
2. **Create-plan dialog**: goal + days + intensity → call decompose → preview/edit the roadmap → Save.
3. **Plan detail**: milestone checklist (self-tick), dynamic progress, a "behind + choices" alert block.
4. **Suggest dialog** (existing): add a **"By plan"** group; "Add to tomorrow" pre-attaches `planId`/`milestoneId`.
5. **Today-page task**: a task in a plan shows a small plan-name chip (lucide icon).

### 10.10 Build order (commit each step)

1. Schema `Plan` + `Milestone` + 2 columns on `Task` → `prisma migrate dev`.
2. `lib/plan.ts` (dynamic progress) + decompose in `lib/ai.ts` + route `/api/plan/decompose`.
3. The "Plans" list page + create-plan dialog (roadmap preview) + plan CRUD server actions.
4. Plan detail page: milestone checklist, progress, behind warning.
5. Extend `/api/suggest`: `activePlans` into context, `plan_tasks` + `plan_alerts` into schema/prompt; the
   suggest dialog adds a "By plan" group; plan chip on the task.

---

## 11. Behavioral layer

> Raises the app from "task reminder" to a system that helps **plan scientifically + sustain discipline**.
> Based on research (filtered, no framework-stuffing). Full roadmap doc: the approved plan file.

### 11.1 Central principle — INVARIANT

The app does NOT optimize _task count_, it optimizes **the probability the user keeps adhering for years
without burning out**. Every new mechanic passes 3 gates: (1) **low friction** — new input must be optional /
one-tap / skippable, the AI degrades gracefully when it's missing; (2) **transparency** — the reason traces to
real data; (3) **ethics** — passes the "regret test", no dark patterns.

### 11.2 DO vs DON'T (conclusions from evidence)

- **DO (strong × cheap):** calibrate to real actuals (reference-class, counters _planning fallacy_); learn
  **difficulty** from emotion history → **split** often-slipped tasks (Fogg-Ability); optional **if-then cue**
  (d≈0.65); **self-compassion** on a miss (shrink + restart, no punishment/red); **loss-soft** streak (1-day
  grace, achievement framing); **80/20 value-score** + 1 MIT; **goal-gradient** ("N tasks left");
  **identity-as-evidence** (reflect the real pattern, no role-play); reward = **informative feedback** (e.g.
  "this week you finished 4 'hard' tasks").
- **DON'T:** XP/level/badge/points tied to task completion, variable reward, punishment, anxiety-push (evidence:
  counter-productive — _overjustification effect_ d≈−0.34); a bloated weekly-planning tier (distant goals have
  little motivational effect); baiting with unfinished work to create tension (_Zeigarnik_ weak/refuted).

### 11.3 Data conventions

- **Difficulty** and **capacity** are NOT stored columns — computed DYNAMICALLY from `emotion` history +
  completion-rate (+ `DayCheckin` if present), like `delay`/`streak`. In `lib/difficulty.ts`, `lib/capacity.ts`.
- **A split task** = a child Task (`parentId`, self-relation, cascade). A parent with ≥1 child is a "container":
  NOT counted in stats/streak/completion-rate (filter `subtasks: { none: {} }` in count queries); the parent's
  `done` is **derived** (all children done), and the parent is never emotion-rated.

---

## 13. Smart Discord notifications

> Push the app from "see it only when opened" to **proactive reminders** via Discord. §11 philosophy is
> INVARIANT: notifications must **support, not pressure, not cause anxiety** (overjustification d≈−0.34 → no
> pressure pushes). CODE computes the real numbers; the AI only writes the **voice** (motivation / a nice quote
> / a tip), it never fabricates.

### 13.1 Channel & scheduling

- **Discord webhook** (one-way, no bot/OAuth). The send layer is split into `lib/notify/discord.ts` so
  Telegram/Slack are easy to add later. The webhook is stored in the DB (page `/notifications`) or falls back to
  env `DISCORD_WEBHOOK_URL`.
- **Internal cron**: `instrumentation.ts` → `lib/notify/scheduler.ts` (node-cron, ticks **every minute**,
  comparing the time to config). The server is always-on (Docker) so the scheduler lives with the app, NO
  external service. `serverExternalPackages: ["node-cron"]` in `next.config.ts`. A `NEXT_PHASE` guard keeps it
  from running at build.
- **Fallback endpoint** `/api/notify/run?kind=&secret=&force=1` (POST/GET) for an external scheduler / "Send
  test". Guarded by `NOTIFY_SECRET`; if the secret is unset the endpoint is OFF.

### 13.2 Five kinds (each toggle + its own time)

1. **morning** (morning brief): today's tasks, streak, the MIT (via `lib/priority`) + motivation/quote/tip.
2. **streak_guard**: fires ONLY when `atRisk` && no task done yet today. Positive framing ("keep your gains"), no threats.
3. **random_nudge**: at most **1/day**, the time seeded by the DAY within a window (`lib/notify/time`), skipped if no undone work.
4. **evening** (evening wrap): a gentle review, suggests a note; no judgment of what's unfinished.
5. **queue_nudge** (§17): the incubating "remind when free" nudge.

`intensity` (minimal | balanced | active) is only a **UI preset** that quickly sets the toggles; the runtime
reads ONLY the toggles + times. There are **quiet hours** (may cross midnight) blocking all notifications. AI
error/no key → **static fallback** (`lib/notify/fallback.ts`).

### 13.3 Data & invariants

- `NotificationSettings` (a single `singleton` row) + `NotificationLog` (idempotency 1/kind/day, the UI history,
  and so the AI avoids repeating phrasing). `runNotification(kind,{force})` (`lib/notify/run.ts`) is the shared
  orchestrator for both cron and "Send test"; it NEVER throws — it always logs. `force` bypasses
  enabled/quiet-hours/idempotency/gating.
- Facts (`lib/notify/context.ts`) trace back to the DB (dynamic streak, MIT, behind plans, capacity); the embed
  attaches a line of real numbers beneath the voice for **transparency**. The AI prompt is in `lib/ai.ts`
  (`composeNotificationVoice`).

### 13.4 UI

- "Notifications" is a **sidebar item (System group)** on desktop + a **top-bar Bell icon** on mobile (2026-06
  overhaul; previously in the sidebar footer). The `/notifications` page splits into **2 tabs** (Settings |
  History) per the §12 standard card set; toggles use `components/ui/switch`; times use `TimePicker`. "Send
  test" auto-saves the current config before firing.

---

## 14. Schedule → capacity-based Day Planner

> NOT Google Calendar. It's a **context + slotting layer**: it tells the suggestion engine the **real free
> time** + the **open slots** each day → more accurate "feasibility", and lets the timeline place tasks at a
> time. The calendar is NOT a Task: it's **not** counted in streak/stats/completion. The AI only *suggests*
> slots (it doesn't impose — transparency, §11); the **server recomputes + validates** the AI's slots (discarding
> any that overlap a hard commitment).

### 14.1 Model (all computed DYNAMICALLY in `lib/schedule.ts`, no hard progress column; local day/time)

- **Hard schedule** `Commitment` (weekly-recurring: `dayOfWeek`, `startTime`/`endTime`, `kind` study|work|other,
  `active`) + **term window** `validFrom`/`validUntil` (auto-expires) + `weekParity` null|odd|even.
- **Soft block** `SoftBlock` (time-blocking, MOVABLE — same fields + term window): does NOT subtract from hard
  free time, only reduces the AI's "suggested budget" (`softLoadMinutes`).
- **One-off** `ScheduleEvent` (`startTime` null = all day; `cancels=true` = day off entirely).
- **Config** `ScheduleSettings` (singleton: `wakeTime`/`sleepTime`/`bufferMin`/`minSlotMin`/`termAnchorMonday`)
  via `lib/schedule-settings.ts`.
- Core functions: `blocksForDate(date, commitments, events, anchorMonday?)` (always filters validity + parity
  when an anchor exists), `softBlocksForDate`, `computeFreeSlots(date, …, config)` → a **list of open slots**
  `{start,end,durationMin}` + `capacityMin` (loosen by buffer, clamp to waking hours, drop slots < minSlot).
  `freeMinutes` = a backward-compatible wrapper (buffer 0). No `rrule` (weekly recurrence + odd/even is enough).

### 14.2 Learning duration/energy (extends §11)

- `Task` adds `estimatedMinutes` (estimate), `deepWork` (prefer morning slots), `actualBucket`
  ("faster"|"asExpected"|"slower" — one tap on done). `computeDifficultyHints` adds `slowTopics`/`fastTopics`.
  All optional/one-tap, NO judgment.
- **Habits** `Habit` + `HabitCheck` (§11): one-tap, DYNAMIC streak (`lib/habits.ts`), **NO points**; isolated
  from Task stats/streak/`weeklyAvg`.

### 14.3 Suggestion integration (one `/api/suggest` flow)

- `SuggestContext` adds `freeSlotsTomorrow`, `suggestedCapacityMin` (= free time − softLoad),
  `preferredWindowsTomorrow`, `habitsToday`. `SuggestionItem` adds `slotStart`/`estimatedMinutes`/`deepWork`.
  Prompt (rule 15): place `slotStart` into a long-enough slot, `deepWork`→early slots, total estimate ≤
  `suggestedCapacityMin`, NEVER overlap the hard schedule. **Trust boundary** at the route: drop any `slotStart`
  outside a real slot.
- Accept: `addTomorrowTask(…, extra)` sets `scheduledFor`/estimate/deepWork; `scheduleTaskAt` reschedules an
  existing task.
- Notifications (§13): `NotificationFacts` carries `todaySchedule` + `freeMinutesToday`.

### 14.4 UI

- **The Today page** = the center: a `FocusBar` (combines the time-budget + a **List ⇄ Timeline** toggle, kept
  via `?view`; the past forces List). `DayTimeline` (a wake→sleep hour bar: hard schedule locked + soft blocks
  dashed + free slots + scheduled tasks + a now line) + `SlotPicker` (place/reschedule, no drag-drop) +
  `HabitStrip` (one-tap). List mode keeps `ScheduleStrip`. (2026-06 overhaul: `CapacityBanner`+`ViewToggle`
  merged into `FocusBar`; the right column gathers the `StatsCards` %-ring, a `CheckinBox` disclosure, a
  collapsed `NoteBox`.)
- **The `/schedule` page** (2026-06 overhaul): a **drag-drop hour grid** `WeekGrid` (drag-create +
  drag-move/resize) + Hard-schedule / Focus-block management. A shared add/edit dialog for all 3 types
  (commitment/soft/event, using `DatePicker`/`TimePicker`) + a collapsible "Term" block. **Habits + "Waking
  hours & time budget" MOVED to `/routines`** (sidebar item "Nhịp sống" / Routines). `/schedule` is a main
  sidebar item (no longer a secondary link).
- Color: neutral + a faint left border by `kind`; soft blocks = dashed + a Move glyph; no loud accent (§12).

---

## 15. MCP Server (Claude reads/writes real data)

> Lets Claude (Claude.ai / Desktop / Cursor / VS Code) plan directly on the app's data via the **Model Context
> Protocol**. INVARIANT: **AI logic is on Claude's side, not the server** — the server only CRUDs + serves
> context (schedule, workload, deadlines). Single-user, no user auth.

### 15.1 Architecture — runs IN the Next app

- Route **`app/api/[transport]/route.ts`** uses `mcp-handler` (`createMcpHandler`, `basePath:"/api"`,
  `disableSse:true` → Streamable HTTP **stateless**, no Redis). Endpoint: `…/api/mcp`.
- **Same process** as the app → shares the `lib/db` Prisma client + every `lib/*` helper; **one process writes
  SQLite**; deploys with the existing container (no new service/Traefik). `serverExternalPackages` adds
  `mcp-handler`, `@modelcontextprotocol/sdk`.
- **Auth required**: bearer `MCP_AUTH_TOKEN` (`lib/mcp/auth.ts`, same pattern as `NOTIFY_SECRET`; token unset =
  endpoint off, 403).

### 15.2 Data layer — `lib/mcp/repository.ts` (zod-validated, reuses `lib/*`)

CRUD task/project + `listTasks`, `getScheduleRange`, `getWorkloadSummary` (reuse
`lib/schedule.blocksForDate/busyMinutes/freeMinutes`, `lib/streak`). **MANDATORY sync rules** (because the app
filters by `done`/`date`, NOT `status`):

- set `scheduledFor` ⇒ set `date` = the local day (`lib/mcp/tz`, `DEFAULT_TIMEZONE`).
- `status=DONE`/`completeTask` ⇒ `done=true`+`completedAt`; other status ⇒ `done=false`.
- `priority` (LOW/MEDIUM/HIGH/URGENT) ⇒ maps to `impact` (the app's 80/20 logic).
- `delete_task` = **HARD delete** (no soft-delete: a CANCELLED task would leak into the UI since the app doesn't filter status).
- Timezone: the DB stores UTC, MCP I/O is ISO 8601, day resolution uses `DEFAULT_TIMEZONE`.
- **LENIENT date contract** (`lib/mcp/tz.ts`): `scheduledFor`/`dueDate`/`startDate`/`targetEndDate` accept
  **both** `"YYYY-MM-DD"` **and** full ISO 8601. `coerceToInstant` turns a date-only into **local midnight**
  (`localMidnightUtc`, NOT UTC-midnight). Do NOT use `z.string().datetime()` (removed — it rejects date-only,
  forcing Claude to send UTC, which shifts the day).
- `rangeSchema` (`get_schedule`/`get_workload_summary`): `to` is optional, defaults `= from`; enforces `from ≤ to`.
- **Error wrapping** (`guard()` in `server.ts`): EVERY tool catches `P2025` (bad id → a clear message) +
  `ZodError` (readable bullets) → returns a soft `isError`, NOT a raw `-32603`; logs `tool`/`ms`/error to stderr
  (`docker logs todo`).

### 15.3 Added schema (additive, nullable — §15, no data loss)

Task adds: `description?`, `status?`, `priority?`, `dueDate?`, `scheduledFor?`, `estimatedMinutes?`,
`tags Tag[]`. New model **`Tag`** (m-n). ⚠️ Model **`Project`** still exists in the DB but is **REMOVED from
MCP** (deprecated): it confused with `Plan` (§10) and has no UI page → every multi-step goal uses **Plan**. Do
NOT re-add `create_project`/`projectId` to MCP.

### 15.4 Tools / Resources / Prompts (`lib/mcp/server.ts`)

- Tools: `ping` (returns `{ok,time,tz,version}`, `version`=`BUILD_SHA` to inspect the running build),
  `create_task`, `update_task`, `complete_task`, `delete_task`, `get_task`, `list_tasks`, `get_schedule`,
  `get_workload_summary`, `bulk_create_tasks`, `list_habits`, `check_habit`. (NO Project tool — removed, §15.3.)
  Descriptions stress: `scheduledFor`≠`dueDate`; call `get_schedule`/`get_workload_summary` BEFORE scheduling;
  `bulk_create_tasks` is only for a SPECIFIC DAY, NOT to pre-fill a whole Plan roadmap.
- **Plan/Milestone (§10 — long-term roadmap, DIFFERENT from a generic `Project`):** `create_plan` (with
  verifiable `milestones[]`), `add_milestones`, `update_plan` (extend deadline/change status — only with the
  user's agreement), `list_plans`/`get_plan` (DYNAMIC progress via `computePlanProgress`:
  `progressPct`/`behindDays`/`currentMilestone`/`daysLeft`), `check_milestone` (the AI may **only suggest** a
  tick, §10.8). `create_task`/`bulk_create_tasks` also accept `planId`/`milestoneId` → the task goes to /plans +
  gets dripped by "Suggest tomorrow". **Creating a Plan = roadmap only: it does NOT auto-generate tasks** (§10.8)
  — tasks drip in rolling, or when the user asks for a specific day. The `plan_project` prompt = create the
  roadmap then STOP.
- **Sync with the day-planner (§14):** `get_schedule` per day returns `blocks` (the hard schedule filtered by
  term window + odd/even week per `ScheduleSettings.termAnchorMonday`) + `softBlocks` (soft blocks, not occupying
  hard budget) + `tasks`. `get_workload_summary` uses `computeFreeSlots` per `ScheduleSettings`
  (waking-hours/buffer/minSlot): returns `freeMinutes` (real budget, buffer subtracted), `softLoadMinutes`,
  `suggestedFreeMinutes` (= free − soft, the budget that SHOULD take new tasks), `freeSlots[]`.
  `create_task`/`update_task` also accept `deepWork`; the serializer returns `deepWork`/`actualBucket`. Habits
  (§11) are isolated from tasks: `list_habits` (dueToday/doneToday/streak — informational, NO points),
  `check_habit` (tick a day, idempotent).
- **Incubating (§17 — the queue of UNcommitted goals, DIFFERENT from Plan/Task):** `add_to_queue` (capture
  `title`+`note?`), `list_queue` (filter by status, default incubating; returns dynamic `ageDays`),
  `update_goal` (title/note/`pinned`/`snoozedUntil`), `drop_goal` (drop — only with the user's agreement, the AI
  doesn't decide), `promote_to_task` (drag into a 1-day Task — reuses `createTask`), `promote_to_plan` (promote
  to a Plan — reuses `createPlan` + milestones, then STOP). Promote ⇒ goal `status=promoted` + back-references
  `promotedTaskId`/`promotedPlanId`. A goal is isolated: NO `date`, not counted in streak/stats.
- Resources: `today_overview` (+ `habits`), `active_plans` (dynamic progress), `incubating_overview`
  (incubating goals + `ageDays`). Prompts: `plan_my_day`, `plan_week`, `plan_project` (→ `create_plan` +
  milestones, drip tasks rolling), `triage_queue` (review Incubating → drag/promote/drop, await approval),
  `review_and_reschedule` — all force the flow: read context → present the plan → **wait for approval** → only
  then write; respect `suggestedFreeMinutes` + attach `scheduledFor` to real `freeSlots`.

### 15.5 Auth — bearer (Desktop/CLI) + OAuth 2.1 (Claude.ai web)

`checkMcpAuth` (`lib/mcp/auth.ts`) accepts **both**: a static bearer `MCP_AUTH_TOKEN` (Claude
Desktop/Cursor/VS Code) **and** an OAuth access JWT. A 401 carries `WWW-Authenticate: …resource_metadata=…` so
Claude.ai self-starts OAuth discovery.

**STATELESS OAuth shim** (`lib/mcp/oauth.ts` + `app/api/oauth/*`) — claude.ai web only supports OAuth, no pasted bearer:

- code/access/refresh are all **HMAC-signed JWTs** (`jose`, key `MCP_OAUTH_SECRET` ?? `MCP_AUTH_TOKEN`) → NO DB
  table. PKCE **S256 required**. Public client (DCR `/register` issues a `client_id`, no secret).
- **Consent gate** at `/api/oauth/authorize`: the owner enters `MCP_AUTH_TOKEN` to confirm → a code is issued.
- Discovery `/.well-known/oauth-authorization-server` + `/.well-known/oauth-protected-resource` via `next.config`
  rewrites (Next ignores dot-directories). Metadata/token/register have CORS + OPTIONS.
- ⚠️ **Anthropic bug (2026-06)**: claude.ai web sometimes completes OAuth but doesn't attach the Bearer to the
  MCP request (401 loop). The server is spec-correct; if hit, wait for Anthropic's fix or use Desktop/Cursor.

### 15.6 Deploy & connect (DIRECT connector — NO mcp-remote)

Compose env `/opt/apps/todo/docker-compose.yml`: `MCP_AUTH_TOKEN` (required), `MCP_OAUTH_SECRET` (set it
separately), `DEFAULT_TIMEZONE`. `BUILD_SHA` is auto-injected via the CI build-arg (`ping` reports the build).
Endpoint `https://<domain>/api/mcp`. **Connect directly, DROP `npx mcp-remote`** (a source of Windows launch
errors `C:\Program` + self-disconnect-on-idle):

- **Claude Code (CLI):** `claude mcp add --transport http todo https://<domain>/api/mcp --header
  "Authorization: Bearer <MCP_AUTH_TOKEN>"` — Streamable HTTP + a static header.
- **Claude Desktop:** Settings → Connectors → Add custom connector → URL `…/api/mcp` → run the OAuth shim
  (consent gate, enter `MCP_AUTH_TOKEN`). No npx.
- `mcp-remote` is only a **fallback**; if used, `command` MUST be `"npx"` (don't use a full path with spaces).
- **Stateless** ⇒ smooth reconnect; a Watchtower restart on deploy drops an open connection for ~a few seconds
  (in-process, §15.1) — normal, the connector reconnects itself; compare `ping.version` if you suspect a mid-flight deploy.

---

## 17. Incubating — the queue of uncommitted goals (Someday/Maybe)

> The **pre-commitment layer** the app previously lacked: a place to dump things you WANT to do but can't handle
> yet, to lighten the mind (GTD Someday/Maybe). Fits §11 (low-friction capture, reduces "too much" anxiety).
> Route `/incubating`, model `Goal`, pure logic `lib/queue.ts`. DIFFERENT from `Task` (has a date) and `Plan`
> (has a roadmap) — this is the stage BEFORE both.

### 17.1 Model & invariants

- **`Goal`** (additive, doesn't touch the old schema): `title`, `note?`, `status`
  (incubating|promoted|dropped), `pinned`, `snoozedUntil?`, `lastNudgedAt?`, `promotedTaskId?`/`promotedPlanId?`
  (back-reference). NO `date`. **Isolated** from streak/stats/completion (like Plan/Habit).
- **Computed DYNAMICALLY, not stored** (`lib/queue.ts`): `goalAgeDays` (age), `isStale` (≥30 days, not pinned,
  not snoozed → enables a "keep/drop" suggestion), `rankGoalsForNudge` (ranks by free-slot fit + capacity +
  pinned + not-recently-nudged), `estimateGoalSize` (a size heuristic — only to fit a slot, NOT to decide task/plan).
- **One-tap capture:** just `title` + Enter; no size/when question at capture.
- **3 exits:** `promoteGoalToTask` (drag into a day → Task, reuses the create-task action), `promoteGoalToPlan`
  (promote → Plan, reuses `createPlan` + `CreatePlanDialog` prefill), or **drop** (soft `dropped`, recoverable).
  No separate task/plan-creation flow.
- **The AI only suggests, the user decides:** suggest a size (`suggestApproach` task|plan), suggest a theme
  grouping, remind when free — all soft suggestions, the reason traces to real data. NO auto-promote/auto-drop.

### 17.2 The "remind when free" intelligence (integrated, no separate flow)

- **Suggest tomorrow** (`/api/suggest`): `SuggestContext.incubatingGoals` (ranked by `rankGoalsForNudge`) + a
  new `queue_pulls` group in `RESPONSE_SCHEMA` (rule 17 in the prompt): suggests ONLY when there's real
  free-time budget left after carry_over+suggested+plan_tasks (no overloading); `suggestApproach` = a size hint;
  ≥2 same-theme items may be suggested as a merged Plan. **Trust boundary** at the route: drop a `goalId` no
  longer incubating. UI: a "From Incubating" group in `suggest-sheet`.
- **Today card** (`components/today/incubating-nudge.tsx`): shows in the right column when free time ≥ 90′ &
  there are incubating items → surfaces a single best-fit item + "Today"/"Plan" buttons.
- **Discord** (§13): the 5th kind `queue_nudge` (its own toggle, shares the `randomWindow` window, a different
  day seed). Gating: fires only when `incubatingCount>0` && `freeMinutesToday≥90` && capacity is not low. After
  sending it sets `lastNudgedAt` (a cooldown — the next round doesn't repeat an item). A tone of "opportunity",
  not pressure; AI error → static fallback. `NotificationFacts` adds
  `incubatingCount`/`topIncubatingGoal`/`topIncubatingApproach`.

### 17.3 MCP (§15.4)

`add_to_queue`, `list_queue`, `update_goal`, `drop_goal`, `promote_to_task`, `promote_to_plan` + the
`incubating_overview` resource + the `triage_queue` prompt. Promote reuses `createTask`/`createPlan`.
