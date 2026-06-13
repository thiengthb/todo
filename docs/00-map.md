# Smart Todo — Map

> One line: a single-user intelligent todo + planner that proposes a *feasible* tomorrow from your real pace. `kind`: web-app (Next.js). Deploy: `todo.thientnse.site` · NUC `/opt/apps/todo`.

## 1. Essence

A personal todo list whose core value is **context-aware suggestion**, not random task generation: at end
of day the AI reads real history (done/undone, delay, emotion, actual completion speed) and proposes a doable
tomorrow with a `reason` per item. Single-user (the owner) — no login / multi-tenant in the app itself. NOT
its goal: gamification, pushing *more* tasks, or any mechanic that optimizes task-count over long-term adherence.

## 2. Stack

| Layer | Technology |
|-----|-----------|
| Framework | Next.js (App Router, TS) · React 19 |
| UI | Tailwind v4 + shadcn/ui (radix-nova) · Motion v12 · Notion-minimal app-shell |
| Data | Prisma + SQLite (named volume `todo_data`) |
| AI | cloud model via a server route handler (`AI_API_KEY`); structured-JSON output only |
| MCP | `mcp-handler` in-process (`/api/mcp`, Streamable HTTP, stateless) — bearer + OAuth shim |
| Deploy | Docker → ghcr → Watchtower → Traefik; web behind Authentik forward-auth (group `todo-access`), MCP/OAuth exempt |

## 3. Module map / entry points

```
app/
  page.tsx              Today — in-day execution (tasks, focus bar, suggest-tomorrow)
  schedule/             Weekly HARD calendar (drag-drop grid) → real free time
  plans/  plans/[id]    Long-term goals: roadmap + milestones + dynamic progress
  incubating/           "Ấp ủ" — uncommitted goals (Someday/Maybe)
  routines/             Habits + waking hours / time budget
  history/              Looking back: past days, streak, rate, "upcoming"
  notifications/ guide/ System: Discord settings · in-app guide
  api/suggest/          the AI suggestion contract (strict JSON)
  api/[transport]/      MCP server · api/oauth/* OAuth shim · api/health · api/notify/run
lib/
  db ai dates utils types                                   core
  plan difficulty capacity velocity streak priority reflection   DYNAMIC compute (no stored columns)
  schedule schedule-grid schedule-settings habits queue     schedule / habits / incubating logic
  notify/{run,scheduler,context,compose,discord,fallback,settings,time}   Discord notifications
  mcp/{server,repository,plan-repository,goal-repository,auth,oauth,tz}   MCP tools + sync rules
```

Models (Prisma): `Task` · `DailyNote` · `Plan` · `Milestone` · `Goal` · `Commitment` · `SoftBlock` ·
`ScheduleEvent` · `ScheduleSettings` · `Habit` · `HabitCheck` · `DayCheckin` · `Tag` · `Project` (deprecated,
removed from MCP — long-term goals route to `Plan`).

## 4. Main flows

1. **Suggest tomorrow** (the core value): `/api/suggest` assembles context from the DB (done+emotion,
   undone+delay, today's & ~7-day completion rate, daily note, active plans, tomorrow's free time, incubating
   pulls) → the model returns strict JSON `{capacity_note, carry_over[], suggested_tasks[], plan_tasks[],
   plan_alerts[], queue_pulls[]}`. Server forces JSON mode, strips ```json fences, try/catch parses. Every
   item carries a `reason` traceable to real input.
2. **Day planner (trust boundary):** the AI only *suggests* time slots; the **server recomputes + validates**
   free slots (`lib/schedule.computeFreeSlots`) and discards any slot that collides with a hard commitment.
3. **MCP:** Claude reads context (`get_schedule` / `get_workload_summary`) → presents a plan → waits for
   approval → only then writes via the repository (AI logic lives on Claude's side, never on the server).

## 5. Highlights

- **Dynamic compute over stored columns** — delay, streak, progress, behind-days, difficulty, capacity,
  free-minutes are computed on read, never persisted (avoids stale data when the source changes).
- **MCP runs in-process** with the Next app → shares `lib/db` + every `lib/*` helper; one process writes SQLite.
- **Stateless OAuth shim** (HMAC-signed JWTs, no DB table) lets claude.ai web connect (it supports only OAuth,
  not a pasted bearer).

## 6. Invariants

- **Single-user:** no in-app login / multi-tenant; the web UI is gated by Authentik forward-auth at Traefik —
  the app does NOT self-code auth.
- **MCP + `/api/health` + OAuth endpoints are NEVER behind forward-auth** (machine clients) — auth at the app
  layer (bearer `MCP_AUTH_TOKEN` / OAuth shim), per platform invariant #8.
- **Behavioral invariant** — optimize long-term adherence, not task-count; every new mechanic passes 3 gates:
  low-friction · transparent (reason ← real data) · ethical (regret test). NO XP/level/badge/points-on-
  completion, variable reward, punishment, or anxiety-push.
- **AI returns structured JSON only; never fabricate a task** — every `reason` traces back to input.
- **Dynamic-compute** — no stored `progress`/`delay`/`difficulty`/`capacity` columns.
- **MCP sync rules** (`lib/mcp/repository.ts`, because the app filters by `done`/`date`, not `status`): set
  `scheduledFor` ⇒ set local `date`; `status=DONE` ⇒ `done=true`; `delete_task` = HARD delete.
- **Naming (CLAUDE.md §16):** "Kế hoạch" = `/plans` only · "Ấp ủ" = `/incubating` only · "Việc" = a dated
  task · "Lịch" = a weekly commitment.

## 7. Secrets / env

| Variable | Used for | Located in | Build-time? |
|------|---------|-------|-------------|
| `AI_API_KEY` / `AI_MODEL` | AI suggestion calls | `.env` NUC | no |
| `MCP_AUTH_TOKEN` | MCP bearer auth (endpoint off if unset) | `.env` NUC | no |
| `MCP_OAUTH_SECRET` | sign OAuth JWTs (falls back to `MCP_AUTH_TOKEN`) | `.env` NUC | no |
| `NOTIFY_SECRET` | guard `/api/notify/run` (off if unset) | `.env` NUC | no |
| `DISCORD_WEBHOOK_URL` | fallback Discord webhook | `.env` NUC or DB | no |
| `DEFAULT_TIMEZONE` | local-day resolution (MCP) | `.env` NUC | no |
| `BUILD_SHA` | MCP `ping` build id | injected at CI build | yes |

> Variable NAMES only, never values.

## 8. Further reading

- Product: `docs/01-product.md` · technical: `docs/02-technical.md` · feature spec (§10–17): `docs/04-features-spec.md` · user guide: `docs/03-user-guide.md`
- Why + pitfalls: `docs/decisions.md`
- Work in flight: `docs/plans/` (status: active)
- Infra/deploy: `INVENTORY.md §1` · related skills: `/react-ui-craft`, `/mcp-builder`
