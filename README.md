# Smart Todo

A personal, intelligent todo list: create tasks during the day, check them off, and rate the effort
(easy / normal / tiring). At end of day, tap **"Đề xuất todo cho ngày mai"** (suggest todos for tomorrow) —
the AI reads your real history (done, undone, delay level, emotion, completion speed) and proposes a
**feasible** list with a **reason** for each item.

> 📚 Full docs in [`docs/`](./docs/): [product](./docs/01-product.md) · [technical](./docs/02-technical.md) ·
> [user guide](./docs/03-user-guide.md) · [feature spec](./docs/04-features-spec.md). AI primer: `docs/00-map.md`.
> Interactive guide in the app: `/guide`. Dev spec & rules: `CLAUDE.md`.

## Stack

Next.js (App Router, TypeScript) · Tailwind + shadcn/ui · Prisma + SQLite · Gemini API (JSON mode)

## Install & run

```bash
npm install

# 1. Configure the environment
cp .env.example .env
#    Fill in AI_API_KEY (free at https://aistudio.google.com/apikey)

# 2. Create the SQLite database
npx prisma migrate dev

# 3. Run
npm run dev          # http://localhost:3000
```

## History & planning

- **Day View** (`/?date=YYYY-MM-DD`): navigate ← → between days right on the main page. The past = observe
  mode (results, emotion, notes — no adding tasks back in time); the future = planning mode (add tasks ahead).
- **`/history`**: a 14-day activity strip (completion rate), an "upcoming plan" section, and a "past" timeline
  with a progress bar + emotion + note per day. Click a day → that day's Day View.

## Discord notifications (§13)

Proactive reminders via Discord, a supportive voice (not pushy): a **morning brief**, a **streak guard** when
the streak is at risk, a **random nudge** to work, and an **evening wrap**. The numbers (streak, task count,
MIT) are computed for real by the system; the AI only adds motivation / a nice quote / a tip.

- Configure at **`/notifications`**: paste the Webhook URL, pick an intensity, toggle + set a time per kind,
  quiet hours, and tap **"Send test"**. Get a webhook: a Discord channel → ⚙ → Integrations → Webhooks → Copy URL.
- Scheduled by an **internal cron** (`instrumentation.ts` + node-cron, ticks every minute) — runs with the
  always-on server, no external service. Times follow `TZ` (prod = `Asia/Ho_Chi_Minh`).
- External fallback call: `POST /api/notify/run?kind=morning&secret=$NOTIFY_SECRET` (set `NOTIFY_SECRET` to
  enable; add `&force=1` to send now, bypassing conditions). Without `AI_API_KEY` it still runs with static content.

## Schedule (§14)

Declare a **hard schedule** (study, work) recurring weekly + **one-off events** at **`/schedule`**. This isn't a
calendar to "get done" but **context**: the app knows the real free time each day, so it suggests
fitting-the-capacity tasks and attaches a `cue` to open slots. The hard schedule doesn't count toward streak/stats.

- A weekly grid (Mon–Sun) + hard-schedule management (toggle, edit, delete). A one-off can be "timed", "all day",
  or "off" (skip the hard schedule that day).
- The **Today** page shows that day's schedule strip + free time; the **morning brief** (Discord) gently mentions it.
- The AI **only suggests** placing tasks into open slots — it doesn't auto-schedule (keep it transparent).

## MCP Server (§15)

Lets Claude (Claude.ai / Desktop / Cursor / VS Code) read–write real data to **self-plan** (daily todos, the
hourly schedule, phased plans, rescheduling). Runs **right inside the Next app** at
`app/api/[transport]/route.ts` (Streamable HTTP, stateless) → shares Prisma + helpers, deploys with the
container, no separate service. AI logic is on Claude's side; the server only CRUDs + serves context.

- **Endpoint**: `https://<domain>/api/mcp` · **Auth**: a static bearer `MCP_AUTH_TOKEN` (Desktop/Cursor/VS Code)
  **or OAuth 2.1** (claude.ai web — a stateless shim at `app/api/oauth/*`, PKCE + DCR, consent via
  `MCP_AUTH_TOKEN`). Token unset = endpoint off.
  > ⚠️ claude.ai web currently has a bug (Anthropic, 2026-06) that sometimes doesn't attach the token after
  > OAuth → if you hit a 401 loop, use Claude Desktop/Cursor/VS Code (bearer) until they fix it.
- **Tools**: task CRUD (`create_task`/`update_task`/`complete_task`/`delete_task`/`get_task`/`list_tasks`/
  `bulk_create_tasks`), `get_schedule`, `get_workload_summary`, plans (`create_plan`/`add_milestones`/
  `update_plan`/`list_plans`/`get_plan`/`check_milestone`), habits (`list_habits`/`check_habit`), incubating queue
  (`add_to_queue`/`list_queue`/`update_goal`/`drop_goal`/`promote_to_task`/`promote_to_plan`), `ping`. (No
  Project tool — deprecated, use Plan.) Prompts: `plan_my_day`, `plan_week`, `plan_project`, `triage_queue`,
  `review_and_reschedule`.
- A task created via MCP **syncs** with the app: `scheduledFor`→`date`, `priority`→`impact`, `status=DONE`→`done`
  → shows immediately on the Today/Schedule pages.
- Local test: `npx @modelcontextprotocol/inspector` → `http://localhost:3000/api/mcp` + header
  `Authorization: Bearer <MCP_AUTH_TOKEN>`.

## Main structure

```
app/page.tsx              Day View (today + any past day via ?date=)
app/history/page.tsx      overview: 14-day strip, upcoming plan, history
app/actions.ts            server actions CRUD (task, note, add-to-tomorrow)
app/api/suggest/route.ts  assemble context from the DB → call AI → return contract JSON
lib/db.ts                 Prisma client singleton
lib/ai.ts                 call Gemini + system prompt + parse/validate JSON
lib/dates.ts              date helpers (local-time, dynamic delay computation)
components/today/         the Today screen's UI pieces
```

## Deploy to the miniserver (Docker + auto-deploy)

Push to `main` → GitHub Actions builds & pushes `ghcr.io/thiengthb/todo` (dual tag `latest` + short git-SHA),
then **Watchtower** on the NUC auto-pulls (≤60s) and restarts. **No self-hosted runner, no build on the NUC**
(platform invariant). Workflow: `.github/workflows/deploy.yml` (docs-only pushes are skipped via `paths-ignore`).

- The app listens on **port 3000** inside the container; only Traefik reaches it over the `edge` network (no host
  port published). Route → Cloudflare Tunnel (`todo.thientnse.site`). Rollback = pin the SHA tag in
  `/opt/apps/todo/docker-compose.yml`.
- The SQLite DB lives in the named volume `todo_data` — it survives every redeploy. On each start the entrypoint
  runs `prisma migrate deploy` before the app, so schema changes need no manual step.
- `TZ=Asia/Ho_Chi_Minh` is set in compose so "today" is computed in VN time.
- Secrets live ONLY in `/opt/apps/todo/.env` on the NUC (chmod 600): `AI_API_KEY`, `MCP_AUTH_TOKEN`,
  `MCP_OAUTH_SECRET`, `NOTIFY_SECRET`, `DEFAULT_TIMEZONE`, optionally `DISCORD_WEBHOOK_URL`. `AI_MODEL` defaults
  to `gemini-2.5-flash`. (`BUILD_SHA` is injected at CI build time.) The CI workflow only builds & pushes the
  image — it does NOT inject runtime secrets into the container.
- **Discord notifications**: the simplest way is to paste the Webhook URL in the app at `/notifications` (stored
  in the DB on `todo_data`, survives every redeploy) — no infra change needed.
- The repo's `docker-compose.yml` is for local dev ONLY.

> Windows/macOS dev note: if you change a dependency, run
> `docker run --rm -v ${PWD}:/app -w /app node:24-alpine npm install --package-lock-only`
> so the lockfile records the optional Linux deps (avoids `npm ci` failing in the image).

## Operational notes

- Data lives in `prisma/dev.db` (gitignored) — backup = copy the file.
- The delay level is not stored; it's computed from `carriedFrom`/creation date to today.
- Carry-over via the "Tomorrow" button in the suggest dialog keeps the original `carriedFrom` chain — a lazy
  task can never "reset" its delay count 😉.
- `scripts/smoke-test.cjs` — quickly seed sample data when you want to test:
  `DATABASE_URL="file:<absolute path to prisma/dev.db>" node scripts/smoke-test.cjs`
```
