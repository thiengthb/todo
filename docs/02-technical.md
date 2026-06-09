# 02 — Tài liệu kỹ thuật

## 1. Stack

| Lớp        | Công nghệ                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Framework  | **Next.js** (App Router, TypeScript strict, React 19)                                                                                 |
| UI         | **Tailwind CSS v4** + **shadcn/ui** (CSS variables, dark/light), **lucide** icon, **sonner** toast, **next-themes**, `tw-animate-css` |
| Dữ liệu    | **Prisma** + **SQLite** (1 file, named volume khi deploy)                                                                             |
| AI         | **Google Gemini** REST, **JSON mode** (`responseSchema`) — gọi từ route handler server, key trong `AI_API_KEY`                        |
| Triển khai | Docker → GitHub Actions → **ghcr.io** → **Watchtower** pull trên NUC → Traefik → Cloudflare Tunnel                                    |

Quy ước: ESM, Node ≥ 22; thư mục/file kebab-case; component PascalCase named-export; cột DB/field API
snake_case (riêng Prisma model dùng camelCase field theo chuẩn Prisma); comment tiếng Việt, code tiếng
Anh; format Prettier (`semi`, singleQuote, printWidth 100). Hook `commit-msg` ép Conventional Commits.

## 2. Mô hình dữ liệu (Prisma)

```prisma
model Task {
  id          String    @id @default(cuid())
  title       String
  done        Boolean   @default(false)
  emotion     String?   // "love" | "meh" | "hard" | null — CHỈ chấm sau khi done
  date        String    // "YYYY-MM-DD" (giờ địa phương)
  carriedFrom String?   // ngày gốc nếu carry-over — để KHÔNG reset mức trì hoãn
  createdAt   DateTime  @default(now())
  completedAt DateTime?

  // Kế hoạch (mục 10)
  planId      String?
  milestoneId String?
  plan        Plan?      @relation(fields: [planId], references: [id], onDelete: SetNull)
  milestone   Milestone? @relation(fields: [milestoneId], references: [id], onDelete: SetNull)

  // Tầng hành vi (mục 11)
  parentId    String?    // task con khi chia nhỏ; cha có ≥1 con = "container"
  parent      Task?      @relation("Subtasks", fields: [parentId], references: [id], onDelete: Cascade)
  subtasks    Task[]     @relation("Subtasks")
  cue         String?    // implementation intention "khi nào/ở đâu"
  impact      String?    // 80/20: "high" | "medium" | "low"
  slipReason  String?    // "tired" | "too_hard" | "no_time" | "unclear" | "deprioritized"
}

model DailyNote   { id; date @unique; note }                       // nhật ký tự do/ngày
model DayCheckin  { id; date @unique; energy? mood? stress? sleepHours? }  // Personal OS, tất cả optional
model Plan        { id; title; goal; startDate; endDate; status; intensity; milestones[]; tasks[] }
model Milestone   { id; planId; title; order; targetDate?; done; tasks[] }  // onDelete Cascade từ Plan
```

### Quy ước "container" (quan trọng)

Task **cha có ≥1 con** là _container_ (nhóm việc đã chia nhỏ): **KHÔNG** tính vào thống kê/streak/tốc
độ thật/đếm việc-của-plan. Mọi query đếm "việc thật" đều lọc `subtasks: { none: {} }`. `done` của
container là **suy ra** (mọi con done); không chấm cảm xúc cho container.

### Giá trị tính ĐỘNG — không lưu cột (tránh lệch dữ liệu)

| Đại lượng                      | Tính ở                           | Cách tính                                                                |
| ------------------------------ | -------------------------------- | ------------------------------------------------------------------------ |
| **delay** (mức trì hoãn)       | `lib/dates.ts` `delayDays`       | số ngày từ `carriedFrom`/ngày tạo → hôm nay (task chưa done)             |
| **streak**                     | `lib/streak.ts` `computeStreaks` | từ danh sách ngày có việc done; **ân hạn 1 ngày** (gap ≤ 2 vẫn nối)      |
| **difficulty**                 | `lib/difficulty.ts`              | gom keyword tiêu đề × lịch sử emotion → `hardTopics`/`easyTopics`        |
| **capacity**                   | `lib/capacity.ts`                | từ `DayCheckin` (energy/mood/stress/sleep) → điểm 0–100, null nếu trống  |
| **plan progress / behindDays** | `lib/plan.ts`                    | từ tỉ lệ thời gian trôi vs % cột mốc done                                |
| **MIT (việc chính)**           | `lib/priority.ts`                | impact×10 + (thuộc plan?3) + min(delay,5); chọn max trong việc chưa xong |
| **reflection**                 | `lib/reflection.ts`              | từ số ngày hoạt động / việc "hard" / tổng việc trong 7 ngày              |

## 3. Bản đồ module

```
app/
  layout.tsx              root: ThemeProvider, AppHeader (+streak tính ở đây), Toaster
  page.tsx                Day View ("/", "/?date=") — fetch + dựng DTO + tính MIT/reflection
  history/page.tsx        toàn cảnh 14 ngày + kế hoạch sắp tới + timeline
  guide/page.tsx          trang hướng dẫn người dùng (có motion)
  actions.ts              "use server" — mọi mutation (task, note, checkin, plan, milestone, cue, impact, slip)
  api/suggest/route.ts    lắp ngữ cảnh từ DB → gọi AI → hậu xử lý (lọc plan_tasks, tính plan_alerts)
  api/plan/decompose/route.ts   mục tiêu → roadmap cột mốc (1 lần lúc tạo plan)
  api/health/route.ts     healthcheck cho Docker

lib/
  db.ts          Prisma singleton
  dates.ts       helper ngày local-time + delayDays
  ai.ts          gọi Gemini (callGeminiJson) + system prompt + JSON schema + parse/validate
  plan.ts        tiến độ plan động
  difficulty.ts  reference-class độ khó từ cảm xúc
  capacity.ts    sức/ngày từ check-in
  priority.ts    chọn MIT theo 80/20
  reflection.ts  câu phản chiếu danh tính/feedback
  streak.ts      chuỗi giữ lửa + ân hạn
  types.ts       kiểu dùng chung (SuggestionItem, SuggestionResult, TaskDTO, Plan…)

components/
  app-header.tsx          nav chung + chip streak + theme toggle
  day-nav.tsx             điều hướng ngày + datepicker
  today/*                 task-item, add-task, note-box, checkin-box, stats-cards, suggest-dialog
  plans/*                 plan-card, create-plan-dialog, milestone-list, plan-actions, behind-alert
  reveal.tsx              wrapper scroll-reveal (motion, IntersectionObserver, tôn trọng prefers-reduced-motion)
  ui/*                    shadcn primitives
```

## 4. Luồng dữ liệu

### 4.1 Mutation — Server Actions

UI client gọi trực tiếp các hàm `"use server"` trong `app/actions.ts`; mỗi hàm `revalidatePath` để
re-render. Thao tác chạm streak (`toggleTask`, `deleteTask`) revalidate cả `layout` để chip cập nhật.
Không có REST CRUD riêng cho task.

### 4.2 Đề xuất ngày mai — `POST /api/suggest`

```
1. Gom song song từ DB (đều lọc container):
   - việc hôm nay, việc còn dở (kèm slipReason), 7 ngày gần (tốc độ),
     14 ngày đã-chấm-cảm-xúc (reference class), note hôm nay,
     plan đang active (+milestones), check-in hôm nay.
2. Tính: weeklyAvg (tốc độ), difficultyHints, capacityScore, activePlans (+progress động).
3. Lắp SuggestContext → suggestTomorrow() → Gemini (JSON mode, responseSchema).
4. Hậu xử lý SERVER (không để model bịa số):
   - lọc plan_tasks có planId hợp lệ;
   - tính plan_alerts (behindDays + lựa chọn) từ tiến độ động.
5. Trả JSON → dialog render: recovery banner, capacity_note, cảnh báo chậm,
   carry-over / việc mới / theo kế hoạch (mỗi item có thể kèm subtasks + cue).
```

### 4.3 Tạo kế hoạch — `POST /api/plan/decompose`

Nhận `{title, goal, startDate, endDate, intensity}` → Gemini trả `{ milestones[] }` (được phép dùng
kiến thức chung về lĩnh vực). **Không lưu DB** — chỉ trả nháp để người dùng xem trước/chỉnh, rồi
`createPlan` server action mới ghi.

## 5. Hợp đồng AI (`lib/ai.ts`)

Tất cả gọi qua `callGeminiJson(systemPrompt, userText, responseSchema, temperature)` — REST,
`responseMimeType: "application/json"` + `responseSchema`. Có `stripFences` + parse/validate thủ công,
lỗi rõ ràng nếu sai shape.

### `SuggestContext` (server lắp, gửi cho model)

`today/tomorrow`, `doneToday[]`, `undone[] (+slipReason)`, `todayRate`, `weeklyAvg`, `note`,
`activePlans[]` (id/goal/currentMilestone/progress/behindDays), `recentDone[]` (reference class),
`difficultyHints`, `todayCheckin`, `capacityScore`.

### JSON model PHẢI trả (`SuggestionResult`)

```jsonc
{
  "capacity_note": "string — giọng tử tế, vì sao chọn ngần này việc",
  "carry_over":      [ Item ],   // việc dở giữ lại (title GIỮ NGUYÊN để đối chiếu)
  "suggested_tasks": [ Item ],   // việc mới
  "plan_tasks":      [ Item + {planId, milestoneId} ],
  "recovery_day": false          // true khi sức thấp → chỉ việc nhẹ
  // plan_alerts: [] — SERVER điền sau, không phải model
}
// Item = { title, priority: high|medium|low, reason (≤20 từ, truy về dữ liệu),
//          subtasks?: string[]   // chia nhỏ việc lớn/khó
//          cue?: string }        // "khi nào/ở đâu"
```

### Luật system prompt (tóm tắt 14 điều)

Calibrate theo tốc độ thật (tổng ≈ `avgDonePerDay` ±1) · giữ việc dở quan trọng · tận dụng đà (emotion
"love") · hạ rào việc hay trượt (theo `slipReason`) · **80/20**: priority theo giá trị/công sức + đảm bảo
có 1 việc chính · không bịa, reason truy về dữ liệu · rót việc plan (gắn `planId`/`milestoneId`, chia
đều) · **chia nhỏ** việc khó/trượt vào `subtasks` (dùng `difficultyHints`/`recentDone`) · **giọng
self-compassion** · gợi **cue** cho 1–2 việc quan trọng · điều chỉnh theo **capacity** + cờ
`recovery_day` · viết tiếng Việt · chỉ trả JSON.

## 6. Motion (trang hướng dẫn)

Dùng **CSS thuần + IntersectionObserver** qua `components/reveal.tsx` — **không** thêm dependency motion
(framer-motion…). `Reveal` fade-up khi phần tử vào viewport, có `delay` để stagger, và **tôn trọng
`prefers-reduced-motion`** (hiện ngay, không animate). Transitions/hover dùng utility Tailwind sẵn có.

## 7. Triển khai

- **Dockerfile** multi-stage: build standalone Next; runtime alpine + openssl/tzdata; entrypoint
  `prisma migrate deploy && node server.js` → **migration tự áp** vào volume `/data` mỗi lần khởi động.
  `EXPOSE 3000`, `HEALTHCHECK` gọi `/api/health`, `DATABASE_URL=file:/data/todo.db`, `TZ=Asia/Ho_Chi_Minh`.
- **CI** (`.github/workflows/deploy.yml`): push `main` → build & push `ghcr.io/<repo>` tag kép
  `latest` + git-SHA ngắn. **Không** self-hosted runner.
- **NUC**: Watchtower pull image mới (≤60s) → restart → Traefik route (label) → Cloudflare Tunnel
  (`*.thientnse.site`). Rollback = ghim tag SHA trong `/opt/apps/todo/docker-compose.yml`.
- `docker-compose.yml` ở repo CHỈ dùng dev local (`HOST_PORT:-3002` → 3000 trong container).
- Secrets: `AI_API_KEY` (GitHub Secret), `AI_MODEL` (Variable, mặc định `gemini-2.5-flash`).

> Lưu ý: phần "Deploy" trong `README.md` còn nhắc self-hosted runner/port 3002 là **cũ**; luồng thật là
> ghcr + Watchtower như trên (xem comment đầu `deploy.yml` và `docker-compose.yml`).

## 8. Chạy & kiểm thử local

```bash
npm install
cp .env.example .env         # điền AI_API_KEY (https://aistudio.google.com/apikey)
npx prisma migrate dev       # tạo SQLite + áp migration
npm run dev                  # http://localhost:3000

npx tsc --noEmit && npm run lint    # kiểm trước commit
npm run build                       # kiểm build production
```

Kiểm thử nhanh tầng AI: bơm dữ liệu mẫu (script `.cjs` dùng `@prisma/client`), gọi `POST /api/suggest`,
kiểm `subtasks`/`cue`/`recovery_day`/`reason` bám dữ liệu thật. (Gemini free thỉnh thoảng trả `503
high demand` — lỗi tạm, route báo lỗi đúng, thử lại.)
