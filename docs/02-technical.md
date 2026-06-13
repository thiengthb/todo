# 02 — Technical documentation

## 1. Stack

| Layer | Technology |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Framework | **Next.js** (App Router, TypeScript strict, React 19) |
| UI | **Tailwind CSS v4** + **shadcn/ui** (CSS variables, dark/light), **lucide** icons, **sonner** toast, **next-themes**, `tw-animate-css` |
| Data | **Prisma** + **SQLite** (one file; a named volume when deployed) |
| AI | **Google Gemini** REST, **JSON mode** (`responseSchema`) — called from a server route handler, key in `AI_API_KEY` |
| Deploy | Docker → GitHub Actions → **ghcr.io** → **Watchtower** pull on the NUC → Traefik → Cloudflare Tunnel |

Conventions: ESM, Node ≥ 22; directories/files kebab-case; components PascalCase named-export; DB columns/API
fields snake_case (Prisma models use camelCase fields per the Prisma standard); **comments and code in English**;
Prettier format (`semi`, singleQuote, printWidth 100). The `commit-msg` hook enforces Conventional Commits.

## 2. Data model (Prisma)

```prisma
model Task {
  id          String    @id @default(cuid())
  title       String
  done        Boolean   @default(false)
  emotion     String?   // "love" | "meh" | "hard" | null — rated ONLY after done
  date        String    // "YYYY-MM-DD" (local time)
  carriedFrom String?   // original date if carried over — so the delay level is NOT reset
  createdAt   DateTime  @default(now())
  completedAt DateTime?

  // Plan (section 10)
  planId      String?
  milestoneId String?
  plan        Plan?      @relation(fields: [planId], references: [id], onDelete: SetNull)
  milestone   Milestone? @relation(fields: [milestoneId], references: [id], onDelete: SetNull)

  // Behavioral layer (section 11)
  parentId    String?    // subtask when split; a parent with ≥1 child = "container"
  parent      Task?      @relation("Subtasks", fields: [parentId], references: [id], onDelete: Cascade)
  subtasks    Task[]     @relation("Subtasks")
  cue         String?    // implementation intention "when/where"
  impact      String?    // 80/20: "high" | "medium" | "low"
  slipReason  String?    // "tired" | "too_hard" | "no_time" | "unclear" | "deprioritized"
}

model DailyNote   { id; date @unique; note }                       // free daily journal
model DayCheckin  { id; date @unique; energy? mood? stress? sleepHours? }  // Personal OS, all optional
model Plan        { id; title; goal; startDate; endDate; status; intensity; milestones[]; tasks[] }
model Milestone   { id; planId; title; order; targetDate?; done; tasks[] }  // onDelete Cascade from Plan
```

### The "container" convention (important)

A **parent task with ≥1 child** is a _container_ (a group of split-out tasks): it is **NOT** counted in
stats/streak/real-speed/plan-task counts. Every "real task" count query filters `subtasks: { none: {} }`. A
container's `done` is **derived** (all children done); a container is never emotion-rated.

### DYNAMICALLY computed values — no stored column (avoids stale data)

| Quantity | Computed in | How |
| ------------------------------ | -------------------------------- | ------------------------------------------------------------------------ |
| **delay** | `lib/dates.ts` `delayDays` | days from `carriedFrom`/creation date → today (tasks not done) |
| **streak** | `lib/streak.ts` `computeStreaks` | from the list of days with a done task; **1-day grace** (gap ≤ 2 still connects) |
| **difficulty** | `lib/difficulty.ts` | aggregate title keywords × emotion history → `hardTopics`/`easyTopics` |
| **capacity** | `lib/capacity.ts` | from `DayCheckin` (energy/mood/stress/sleep) → 0–100 score, null if empty |
| **plan progress / behindDays** | `lib/plan.ts` | from elapsed-time ratio vs % of milestones done |
| **MIT (most important task)** | `lib/priority.ts` | impact×10 + (in a plan? 3) + min(delay,5); pick the max among undone tasks |
| **reflection** | `lib/reflection.ts` | from active days / "hard" tasks / total tasks over 7 days |

## 3. Module map

```
app/
  layout.tsx              root: ThemeProvider, AppHeader (+streak computed here), Toaster
  page.tsx                Day View ("/", "/?date=") — fetch + build DTO + compute MIT/reflection
  history/page.tsx        14-day overview + upcoming plan + timeline
  guide/page.tsx          in-app user guide page (has motion)
  actions.ts              "use server" — every mutation (task, note, checkin, plan, milestone, cue, impact, slip)
  api/suggest/route.ts    assemble context from the DB → call AI → post-process (filter plan_tasks, compute plan_alerts)
  api/plan/decompose/route.ts   goal → milestone roadmap (once, at plan creation)
  api/health/route.ts     healthcheck for Docker

lib/
  db.ts          Prisma singleton
  dates.ts       local-time date helpers + delayDays
  ai.ts          call Gemini (callGeminiJson) + system prompt + JSON schema + parse/validate
  plan.ts        dynamic plan progress
  difficulty.ts  reference-class difficulty from emotion
  capacity.ts    capacity/day from check-in
  priority.ts    pick the MIT by 80/20
  reflection.ts  identity/feedback reflection line
  streak.ts      streak + grace
  types.ts       shared types (SuggestionItem, SuggestionResult, TaskDTO, Plan…)

components/
  app-header.tsx          shared nav + streak chip + theme toggle
  day-nav.tsx             day navigation + datepicker
  today/*                 task-item, add-task, note-box, checkin-box, stats-cards, suggest-dialog
  plans/*                 plan-card, create-plan-dialog, milestone-list, plan-actions, behind-alert
  reveal.tsx              scroll-reveal wrapper (motion, IntersectionObserver, respects prefers-reduced-motion)
  ui/*                    shadcn primitives
```

## 4. Data flow

### 4.1 Mutations — Server Actions

The client UI calls the `"use server"` functions in `app/actions.ts` directly; each function `revalidatePath`s
to re-render. Streak-touching operations (`toggleTask`, `deleteTask`) also revalidate `layout` so the chip
updates. There is no separate REST CRUD for tasks.

### 4.2 Suggest tomorrow — `POST /api/suggest`

```
1. Gather in parallel from the DB (all filtering out containers):
   - today's tasks, undone tasks (with slipReason), the last 7 days (speed),
     the last 14 emotion-rated days (reference class), today's note,
     active plans (+milestones), today's check-in.
2. Compute: weeklyAvg (speed), difficultyHints, capacityScore, activePlans (+dynamic progress).
3. Assemble SuggestContext → suggestTomorrow() → Gemini (JSON mode, responseSchema).
4. SERVER post-processing (don't let the model fabricate numbers):
   - keep plan_tasks with a valid planId;
   - compute plan_alerts (behindDays + choices) from dynamic progress.
5. Return JSON → the dialog renders: recovery banner, capacity_note, behind warnings,
   carry-over / new tasks / plan tasks (each item may carry subtasks + a cue).
```

### 4.3 Create a plan — `POST /api/plan/decompose`

Takes `{title, goal, startDate, endDate, intensity}` → Gemini returns `{ milestones[] }` (allowed to use
general domain knowledge). **Not saved to the DB** — it returns a draft for the user to preview/edit, then the
`createPlan` server action writes it.

## 5. AI contract (`lib/ai.ts`)

Everything goes through `callGeminiJson(systemPrompt, userText, responseSchema, temperature)` — REST,
`responseMimeType: "application/json"` + `responseSchema`. With `stripFences` + manual parse/validate, and a
clear error on a wrong shape.

### `SuggestContext` (server-assembled, sent to the model)

`today/tomorrow`, `doneToday[]`, `undone[] (+slipReason)`, `todayRate`, `weeklyAvg`, `note`, `activePlans[]`
(id/goal/currentMilestone/progress/behindDays), `recentDone[]` (reference class), `difficultyHints`,
`todayCheckin`, `capacityScore`.

### JSON the model MUST return (`SuggestionResult`)

```jsonc
{
  "capacity_note": "string — a kind voice, why this many tasks",
  "carry_over":      [ Item ],   // undone tasks kept (title KEPT AS-IS for matching)
  "suggested_tasks": [ Item ],   // new tasks
  "plan_tasks":      [ Item + {planId, milestoneId} ],
  "recovery_day": false          // true when capacity is low → light tasks only
  // plan_alerts: [] — the SERVER fills this later, not the model
}
// Item = { title, priority: high|medium|low, reason (≤20 words, traces to data),
//          subtasks?: string[]   // split a large/hard task
//          cue?: string }        // "when/where"
```

### System-prompt rules (14, summarized)

Calibrate to real speed (total ≈ `avgDonePerDay` ±1) · keep important undone work · use momentum (emotion
"love") · lower the bar for often-slipped work (per `slipReason`) · **80/20**: priority by value/effort + ensure
one MIT · don't fabricate, reason traces to data · drip plan tasks (attach `planId`/`milestoneId`, split evenly)
· **split** hard/slipped work into `subtasks` (use `difficultyHints`/`recentDone`) · **self-compassion voice** ·
suggest a **cue** for 1–2 important tasks · adjust to **capacity** + the `recovery_day` flag · write in
Vietnamese · return JSON only.

## 6. Motion (the guide page)

Uses **plain CSS + IntersectionObserver** via `components/reveal.tsx` — **no** added motion dependency
(framer-motion…). `Reveal` fades-up when an element enters the viewport, has a `delay` for stagger, and
**respects `prefers-reduced-motion`** (shows immediately, no animation). Transitions/hover use existing Tailwind
utilities.

> Note (2026-06): the app has since adopted **Motion v12** per `/react-ui-craft` (the framer-motion ban is
> lifted) — see `CLAUDE.md §12`. `reveal.tsx` remains the lightweight scroll-reveal helper.

## 7. Deploy

- **Dockerfile** multi-stage: build standalone Next; runtime alpine + openssl/tzdata; entrypoint
  `prisma migrate deploy && node server.js` → **migrations auto-apply** to the `/data` volume on every start.
  `EXPOSE 3000`, `HEALTHCHECK` hits `/api/health`, `DATABASE_URL=file:/data/todo.db`, `TZ=Asia/Ho_Chi_Minh`.
- **CI** (`.github/workflows/deploy.yml`): push `main` → build & push `ghcr.io/<repo>` with dual tags
  `latest` + short git-SHA. **No** self-hosted runner. (Docs-only pushes are skipped via `paths-ignore`.)
- **NUC**: Watchtower pulls the new image (≤60s) → restart → Traefik route (label) → Cloudflare Tunnel
  (`*.thientnse.site`). Rollback = pin the SHA tag in `/opt/apps/todo/docker-compose.yml`.
- The repo's `docker-compose.yml` is for local dev ONLY (`HOST_PORT:-3002` → 3000 in the container).
- Secrets: `AI_API_KEY` (GitHub Secret), `AI_MODEL` (Variable, default `gemini-2.5-flash`).

> Note: the "Deploy" section in `README.md` still mentions a self-hosted runner / port 3002 — that is **stale**;
> the real flow is ghcr + Watchtower as above (see the header comments in `deploy.yml` and `docker-compose.yml`).

## 8. Run & test locally

```bash
npm install
cp .env.example .env         # fill in AI_API_KEY (https://aistudio.google.com/apikey)
npx prisma migrate dev       # create SQLite + apply migrations
npm run dev                  # http://localhost:3000

npx tsc --noEmit && npm run lint    # check before commit
npm run build                       # check the production build
```

Quick AI-layer test: seed sample data (a `.cjs` script using `@prisma/client`), call `POST /api/suggest`, and
check that `subtasks`/`cue`/`recovery_day`/`reason` track the real data. (Gemini free occasionally returns `503
high demand` — a transient error; the route reports it correctly, retry.)
