# Smart Todo — Project Spec & Build Rules

> File này vừa là **prompt khởi tạo** (dán vào Claude Code/Cowork để generate toàn bộ dự án),
> vừa là **rule** Claude phải tuân theo trong suốt quá trình code. Đọc kỹ trước mỗi lần sửa.

---

## 1. Mục tiêu sản phẩm

Một todo list cá nhân thông minh. Người dùng tạo task trong ngày, đánh dấu xong và chấm cảm xúc
(dễ / bình thường / mệt). Cuối ngày bấm một nút, AI đọc lịch sử + đánh giá và đề xuất todo list
**khả thi** cho ngày mai, kèm **lý do** cho từng việc.

Giá trị cốt lõi KHÔNG phải "generate task ngẫu nhiên" mà là **đề xuất dựa trên ngữ cảnh cá nhân thật**:
việc đã xong, việc bỏ dở, mức trì hoãn, cảm xúc, và tốc độ hoàn thành thực tế.

Đây là app **một người dùng** (chính chủ). KHÔNG cần đăng nhập, multi-tenant, hay phân quyền.

## 2. Nguyên tắc thiết kế (bắt buộc giữ)

- **Tối giản kiểu Notion**: nhiều khoảng trắng, viền mảnh, không gradient/đổ bóng nặng, không màu mè.
- **Ít ma sát**: chấm cảm xúc chỉ 1 chạm và CHỈ mở khi task đã xong (đánh giá việc chưa làm là vô nghĩa).
- **Minh bạch**: mỗi đề xuất của AI luôn có trường `reason` ngắn, truy ngược được về dữ liệu thật.
- **Nhẹ, nhanh, dễ duy trì**: ưu tiên ít phụ thuộc, chạy được bằng `npm run dev` không cần Docker.

## 3. Tech stack (KHÔNG tự ý đổi)

- Next.js (App Router, TypeScript)
- Tailwind CSS + shadcn/ui cho UI
- Prisma + SQLite (1 file `dev.db`, không cần MySQL/Redis)
- AI: gọi API cloud qua **route handler phía server** (`/app/api/suggest/route.ts`).
  KHÔNG để API key lộ ra client. Đọc key từ biến môi trường `AI_API_KEY`.
- Đề xuất AI phải trả về **JSON có cấu trúc** (xem mục 6), không trả văn xuôi tự do.

## 4. Mô hình dữ liệu (Prisma schema)

```prisma
model Task {
  id          String   @id @default(cuid())
  title       String
  done        Boolean  @default(false)
  emotion     String?  // "love" | "meh" | "hard" | null
  date        String   // ngày gắn task, dạng "YYYY-MM-DD"
  carriedFrom String?  // nếu được carry-over từ ngày trước, lưu ngày gốc
  createdAt   DateTime @default(now())
  completedAt DateTime?
}

model DailyNote {
  id    String @id @default(cuid())
  date  String @unique // "YYYY-MM-DD"
  note  String // ghi chú cuối ngày của người dùng
}
```

> "Mức trì hoãn" KHÔNG lưu cứng — tính động: số ngày giữa `createdAt`/`carriedFrom` và hôm nay
> với task chưa `done`. Tránh dữ liệu lệch.

## 5. Màn hình cần dựng

1. **Hôm nay** (`/`):
   - Danh sách task của ngày hiện tại: checkbox tròn, tiêu đề, 3 nút cảm xúc (khóa khi chưa done), nút xóa.
   - Task chưa xong & trì hoãn ≥2 ngày hiển thị badge cảnh báo "trì hoãn Nd".
   - Ô thêm task (Enter để thêm).
   - 3 thẻ số: Đã xong (x/y), Tỉ lệ %, Còn dở.
   - Textarea "Hôm nay của bạn thế nào?" (tùy chọn) → lưu vào DailyNote.
   - Nút "Đề xuất todo cho ngày mai".

2. **Đề xuất ngày mai** (modal hoặc `/tomorrow`):
   - Hiển thị kết quả JSON từ AI: nhóm `carry_over` và `suggested_tasks`, mỗi việc có badge ưu tiên + `reason`.
   - Hiển thị `capacity_note`.
   - Mỗi đề xuất có nút **"Thêm vào ngày mai"** → tạo Task với `date` = ngày mai.

## 6. Hợp đồng AI (quan trọng nhất)

Route `/api/suggest` nhận ngữ cảnh và gọi model. **System prompt** phải dạy model các nguyên tắc sau:

- Hiệu chỉnh theo **tốc độ thực tế**, không theo mong muốn. Nếu gần đây thường xong ~N việc/ngày,
  đề xuất khoảng N (±1), KHÔNG nhồi nhiều rồi để bỏ dở.
- **Giữ lại** việc dở quan trọng, ưu tiên cao hơn nếu đã trì hoãn nhiều ngày; gợi ý chia nhỏ nếu nó quá lớn.
- **Tận dụng đà**: việc mới liên quan tới việc vừa xong (đặc biệt emotion="love") nên xếp nối tiếp.
- **Hạ rào cản** cho việc hay bị trượt: đề xuất phiên bản nhỏ hơn để dễ hoàn thành (giữ chuỗi).
- Xếp **việc nặng vào đầu ngày**, việc nhẹ lấp khoảng nghỉ.
- TUYỆT ĐỐI không bịa task không liên quan tới dữ liệu. Mỗi `reason` phải truy ngược được về input.

Model PHẢI trả về **đúng JSON này, không kèm văn bản/markdown nào khác**:

```json
{
  "capacity_note": "string — vì sao chọn số lượng task này, dựa trên tốc độ thực tế",
  "carry_over": [
    {
      "title": "string",
      "priority": "high|medium|low",
      "reason": "string ngắn"
    }
  ],
  "suggested_tasks": [
    {
      "title": "string",
      "priority": "high|medium|low",
      "reason": "string ngắn"
    }
  ]
}
```

Server phải: ép định dạng JSON (dùng response_format/JSON mode nếu API hỗ trợ), `try/catch` parse,
strip ```json fences nếu có, và trả lỗi rõ ràng nếu parse thất bại.

Input gửi cho model (server tự lắp từ DB):

- Task đã xong hôm nay (kèm emotion).
- Task còn dở (kèm số ngày trì hoãn).
- Tỉ lệ hoàn thành hôm nay + trung bình ~7 ngày gần nhất nếu có.
- DailyNote hôm nay (nếu có).

## 7. Yêu cầu chất lượng code

- TypeScript strict. Không `any` trừ khi bắt buộc và có chú thích.
- Tách logic: `lib/db.ts` (Prisma client singleton), `lib/ai.ts` (gọi model + parse), `lib/dates.ts` (helper ngày).
- UI dùng component shadcn; giữ palette trung tính, viền `border` mảnh, bo góc vừa.
- KHÔNG dùng localStorage cho dữ liệu thật — tất cả qua Prisma/SQLite.
- Có file `.env.example` ghi rõ `AI_API_KEY=` và `AI_MODEL=`.
- README ngắn: cách cài, `npx prisma migrate dev`, `npm run dev`.

## 8. Thứ tự build (làm theo đúng trình tự, commit từng bước)

1. Khởi tạo Next.js + Tailwind + shadcn, cấu hình Prisma + SQLite, chạy migrate đầu tiên.
2. CRUD Task + màn hình "Hôm nay" (chưa có AI). Đảm bảo thêm/xong/chấm cảm xúc/xóa hoạt động.
3. DailyNote + 3 thẻ thống kê + badge trì hoãn.
4. `lib/ai.ts` + route `/api/suggest` với system prompt ở mục 6, trả JSON đúng schema.
5. Màn hình "Đề xuất ngày mai" + nút "Thêm vào ngày mai".
6. Dọn UI cho đúng tinh thần Notion, viết README + .env.example.

## 9. Khi không chắc

Hỏi lại một câu ngắn trước khi tự quyết định những thứ ảnh hưởng kiến trúc.
Không thêm phụ thuộc nặng (auth, state manager, ORM khác) mà không xác nhận.

---

## 10. Tính năng Kế hoạch (Plan)

> Mở rộng app sang **mục tiêu dài hạn** (vd "Học tiếng Nhật cơ bản trong 1 tháng").
> Triết lý bất biến: **bám tốc độ thật, không theo mong muốn** — y như phần đề xuất ngày mai.
> KHÔNG làm "lịch cứng 30 ngày" (đẻ sẵn mọi task → lệch là chất đống task quá hạn, đi ngược app).

### 10.1 Cơ chế cốt lõi — Roadmap cuốn chiếu (rolling)

Kế hoạch tách 2 tầng:

- **Roadmap (cột mốc)** — tương đối ổn định: mục tiêu + vài milestone lớn do AI sinh lúc tạo,
  người dùng chỉnh được. VD: Tuần 1 Hiragana → Tuần 2 Katakana → Tuần 3: 100 từ vựng → Tuần 4: câu đơn.
- **Task hằng ngày** — sinh động, cuốn chiếu: AI KHÔNG đẻ sẵn 30 ngày. Mỗi ngày chỉ rót 1–2 task
  kế tiếp dựa trên _đang ở đâu trên roadmap_ + _tốc độ thật mấy hôm nay_ + _cảm xúc_. Đi nhanh → đẩy
  tới; chậm → co task / giãn deadline.

### 10.2 Tích hợp — HÒA vào `/api/suggest`, không tạo luồng đề xuất riêng

Task của plan chỉ là loại đề xuất thứ 3 bên cạnh `carry_over` và `suggested_tasks`. Một nút "Đề xuất
ngày mai" ra cả 3 nhóm. `reason` của plan task truy ngược về **milestone** (thay vì việc hôm qua).

### 10.3 Nhiều plan song song — chia sức

Cho phép nhiều plan `active` cùng lúc (vd vừa tiếng Nhật vừa gym). AI biết tổng sức/ngày có hạn
(= `avgDonePerDay` thật) nên **chia đều giữa các plan**, không nhồi. Tổng (carry_over + suggested +
plan_tasks) vẫn ≈ `avgDonePerDay` (±1).

### 10.4 Khi chậm tiến độ — cảnh báo + để người dùng chọn

AI phát hiện trễ, nói rõ "chậm ~N ngày" rồi đưa 2–3 lựa chọn (giãn deadline / bỏ bớt milestone /
giữ nguyên & tăng tốc) để người dùng bấm. **Không tự co giãn ngầm** (giữ minh bạch).

### 10.5 Đo tiến độ — ĐỘNG, không lưu cứng (giống `delay`, `streak`)

Không có cột `progress` trong DB. Tính trên đường truyền (đặt trong `lib/plan.ts`):

```
milestoneKỳvọng = round( daysBetween(start, today) / daysBetween(start, end) × tổngMilestone )
behindDays      = quy ra ngày từ chênh lệch giữa số milestone đã done thực tế và mốc kỳ vọng
progressPct     = milestone done / tổng milestone
```

### 10.6 Mô hình dữ liệu (Task gần như không đổi)

```prisma
model Plan {
  id        String   @id @default(cuid())
  title     String
  goal      String   // định nghĩa "xong" + bối cảnh
  startDate String   // "YYYY-MM-DD"
  endDate   String   // mốc mục tiêu
  status    String   @default("active") // active | paused | done | archived
  intensity String   @default("vừa")    // nhẹ | vừa | dồn — gợi ý mềm cho AI
  createdAt DateTime @default(now())
  milestones Milestone[]
  tasks      Task[]
}

model Milestone {
  id         String   @id @default(cuid())
  planId     String
  plan       Plan     @relation(fields: [planId], references: [id], onDelete: Cascade)
  title      String
  order      Int      // thứ tự trong roadmap
  targetDate String?
  done       Boolean  @default(false)
  tasks      Task[]
}

// Task CHỈ thêm 2 cột optional + relation → streak/stats/emotion/delay chạy nguyên vẹn:
//   planId      String?
//   milestoneId String?
//   plan        Plan?      @relation(fields: [planId], references: [id])
//   milestone   Milestone? @relation(fields: [milestoneId], references: [id])
```

### 10.7 Hai lời gọi AI

- **Decompose** — route mới `/api/plan/decompose`, chỉ chạy lúc tạo plan. Input: `title`, `goal`,
  `durationDays`, `intensity`. Output JSON `{ milestones: [{ title, order, targetDate }] }`. ĐÂY là
  chỗ AI ĐƯỢC dùng kiến thức chung (giáo trình chuẩn mực); mỗi milestone là kết quả kiểm chứng được
  ("Thuộc bảng Hiragana"), không mơ hồ ("Học chăm chỉ"). Logic + prompt đặt trong `lib/ai.ts`.
- **Daily inject** — mở rộng `/api/suggest`: `SuggestContext` thêm `activePlans` (id, title, goal,
  currentMilestone, progressPct, behindDays); `RESPONSE_SCHEMA` thêm `plan_tasks` (kèm `planId`,
  `milestoneId`) và `plan_alerts: [{ planId, behindDays, options: string[] }]`.

### 10.8 Quy ước đã chốt (mặc định)

- **Sức chứa** lấy từ `avgDonePerDay` thật; `intensity` chỉ là gợi ý mềm — KHÔNG bắt nhập "phút/ngày".
- **Milestone done**: người dùng tự tick trên trang chi tiết; AI chỉ được _gợi ý_, KHÔNG tự tick.
- **Tạo plan xong KHÔNG tự sinh task hôm nay** — chỉ rót qua nút "Đề xuất ngày mai".

### 10.9 Màn hình

1. Nav thêm **"Kế hoạch"** → danh sách plan (card: vòng % tiến độ, milestone hiện tại, badge "chậm Nd").
2. **Dialog tạo plan**: mục tiêu + số ngày + intensity → gọi decompose → xem trước/chỉnh roadmap → Lưu.
3. **Chi tiết plan**: checklist milestone (tự tick), tiến độ động, khối cảnh báo "chậm + lựa chọn".
4. **Dialog suggest** (đã có): thêm nhóm **"Theo kế hoạch"**; "Thêm vào ngày mai" gắn sẵn `planId`/`milestoneId`.
5. **Task trang Hôm nay**: task thuộc plan hiện chip nhỏ tên plan (icon lucide).

### 10.10 Thứ tự build (commit từng bước)

1. Schema `Plan` + `Milestone` + 2 cột trên `Task` → `prisma migrate dev`.
2. `lib/plan.ts` (tính tiến độ động) + decompose trong `lib/ai.ts` + route `/api/plan/decompose`.
3. Trang danh sách "Kế hoạch" + dialog tạo plan (xem trước roadmap) + server actions CRUD plan.
4. Trang chi tiết plan: milestone checklist, tiến độ, cảnh báo chậm.
5. Mở rộng `/api/suggest`: `activePlans` vào context, `plan_tasks` + `plan_alerts` vào schema/prompt;
   dialog suggest thêm nhóm "Theo kế hoạch"; chip plan trên task.

---

## 11. Tầng hành vi học (Behavioral layer)

> Nâng app từ "nhắc việc" thành hệ thống giúp **lập kế hoạch khoa học + duy trì kỷ luật bền vững**.
> Dựa trên nghiên cứu (đã lọc, không nhồi framework). Tài liệu lộ trình đầy đủ: plan file đã duyệt.

### 11.1 Nguyên tắc trung tâm — BẤT BIẾN

App KHÔNG tối ưu _số task hoàn thành_, mà tối ưu **xác suất người dùng còn duy trì kế hoạch sau
nhiều năm mà không kiệt sức**. Mọi cơ chế mới phải qua 3 cửa: (1) **ma sát thấp** — input mới phải
tùy chọn / 1 chạm / bỏ qua được, AI degrade mượt khi thiếu; (2) **minh bạch** — reason truy về dữ
liệu thật; (3) **đạo đức** — qua "regret test", không dark pattern.

### 11.2 LÀM vs KHÔNG (kết luận từ bằng chứng)

- **LÀM (mạnh × rẻ):** calibrate theo actuals thật (reference-class, chống _planning fallacy_);
  học **độ khó** từ lịch sử emotion → **chia nhỏ** việc hay trượt (Fogg-Ability); **if-then cue**
  tùy chọn (d≈0.65); **self-compassion** khi trượt (co nhỏ + bắt đầu lại, không phạt/đỏ); streak
  **loss-soft** (ân hạn 1 ngày, framing thành tích); **80/20 value-score** + 1 MIT; **goal-gradient**
  ("còn N việc"); **identity-as-evidence** (phản chiếu pattern thật, không bắt role-play);
  reward = **feedback thông tin** (vd "tuần này xong 4 việc 'khó'").
- **KHÔNG:** XP/level/badge/điểm số gắn vào hoàn thành task, variable reward, phạt, push gây lo âu
  (bằng chứng: phản tác dụng — _overjustification effect_ d≈−0.34); tầng weekly-planning rườm rà
  (mục tiêu xa ít tác dụng động lực); nhử việc dở để tạo căng thẳng (_Zeigarnik_ yếu/bị bác).

### 11.3 Quy ước dữ liệu

- **Độ khó** và **capacity** KHÔNG lưu cột — suy ĐỘNG từ lịch sử `emotion` + completion-rate
  (+ `DayCheckin` nếu có), giống `delay`/`streak`. Đặt ở `lib/difficulty.ts`, `lib/capacity.ts`.
- **Task chia nhỏ** = Task con (`parentId`, self-relation, cascade). Task cha có ≥1 con là "container":
  KHÔNG tính vào stats/streak/completion-rate (lọc `subtasks: { none: {} }` ở các query đếm); `done`
  của cha là **suy ra** (mọi con done), không chấm emotion cho cha.

---

## 12. Quy ước giao diện (UI shell & layout) — BẮT BUỘC

> Đại tu 2026-06: app dùng **app-shell** thay nav ngang. Giữ trung tính kiểu Notion nhưng tận dụng
> desktop, ít ngợp. Dựa trên nghiên cứu (NN/g, Refactoring UI). Mọi trang/feature mới phải bám.

- **Khung:** `components/app-shell.tsx` bọc toàn app (render ở `layout.tsx`). Desktop ≥`lg`: **sidebar
  trái** thu gọn được (nav + chip streak + theme ở footer). Mobile <`lg`: **top-bar mỏng** (brand +
  streak + theme) + **bottom tab bar** (4 mục, luôn hiện — KHÔNG hamburger). Chip streak tách ở
  `components/streak-chip.tsx`.
- **Bề rộng (ĐỒNG NHẤT, chốt 2026-06):** shell tự căn giữa **`max-w-5xl`** (≈1024px) + px cho **MỌI
  trang**. **Trang KHÔNG tự đặt `<main>`/`max-w`/`mx-auto`/`px` riêng** — chỉ render `<div className="py-8">`
  nội dung (shell sở hữu width + px). Khối CHỮ dài (hero/CTA trang Guide) tự bọc `mx-auto max-w-2xl` BÊN
  TRONG cho dễ đọc, nhưng khung trang vẫn cùng bề rộng.
- **Hôm nay = dashboard 2 cột** (`lg:grid-cols-[minmax(0,1fr)_300px]`): việc bên trái, thống kê/
  check-in/đề xuất bên phải; mobile xếp dọc. **Ghi chú "Hôm nay của bạn…" nằm CUỐI cột việc** (không tách
  `max-w` riêng) để thẳng hàng đúng bằng các thanh todo. Mục tiêu: thấy hết, đỡ cuộn.
- **Header trang dùng chung `components/page-header.tsx`** (eyebrow + h1 `text-xl sm:text-2xl` + mô tả +
  action phải + back-link "‹ …"). **Trạng thái rỗng dùng `components/empty-state.tsx`.** Không tự chế
  header/empty rời rạc mỗi trang.
- **Bộ card chuẩn (BẮT BUỘC, hết "lệch"):** khối nổi = `rounded-lg border border-border/70 p-4`
  (KHÔNG `<Card>` ring, KHÔNG `rounded-xl`/`p-6` rải rác, KHÔNG `border-input`). Hàng danh sách =
  `flex items-center gap-3 border-b border-border/70 py-3 last:border-b-0` + `hover:bg-muted/40
  transition-colors` nếu bấm/tương tác được. Section cách nhau `space-y-10`; trang mở đầu `py-8`.
- **Mô tả dài → `components/info-hint.tsx`** (icon ⓘ mở Popover khi chạm — KHÔNG tooltip-hover, để hợp
  cảm ứng + a11y). Giữ nhãn thao tác hiển thị; chỉ giấu phần _giải thích khái niệm_.
- **Luồng tham chiếu (không-chặn) dùng Sheet**, không modal cuộn dài: "Đề xuất ngày mai" =
  `components/today/suggest-sheet.tsx` (Sheet phải, header/footer cố định, danh sách trong `ScrollArea`).
  Dialog (centered) chỉ cho xác nhận ngắn / form gọn; form dài → 2 cột + `ScrollArea`.
- **KHÔNG breadcrumb** (app nông): dùng tiêu đề trang + link "‹ …" ở trang con.
- **Thanh cuộn** tùy biến theo theme (đã set global trong `globals.css`); vùng bounded dùng shadcn
  `ScrollArea`.
- **Motion = CSS + Radix `data-[state]` + (tùy chọn) View Transitions** — **KHÔNG thêm framer-motion**.
  Micro-interaction nhẹ (`transition-colors`, `active:scale-*`); hiệu ứng cuộn-hiện dùng
  `components/reveal.tsx`. LUÔN tôn trọng `prefers-reduced-motion` (đã có guard global).
- **Màu:** trung tính thuần; chỉ dùng màu **ngữ nghĩa** (amber quá hạn, emerald xong/phục hồi, rose mệt).
  Hành động chính = nút `default` (đen/trắng). KHÔNG thêm accent thương hiệu, KHÔNG gradient.
- **iPhone / mobile (chốt 2026-06):** `layout.tsx` export `viewport` với `viewportFit: "cover"`. Bottom
  tab bar `pb-[env(safe-area-inset-bottom)]`, top-bar `pt-[env(safe-area-inset-top)]`, main mobile
  `pb-[calc(env(safe-area-inset-bottom)+5rem)]` — KHÔNG để bar đè home-indicator. Tap target ≥ ~44px
  (tab bar `min-h-12`; nút cảm ứng nhỏ nới `size-9 sm:size-7`). Giữ look trung tính (không large-title,
  không inset-grouped).
- **shadcn:** đã thêm `sheet`, `scroll-area`, `switch` (unified `radix-ui`, style radix-nova `data-open/closed`).

---

## 13. Thông báo Discord thông minh

> Đẩy app từ "mở mới thấy" sang **chủ động nhắc** qua Discord. Triết lý §11 BẤT BIẾN: thông báo phải
> **nâng đỡ, không hối thúc, không gây lo âu** (overjustification d≈−0.34 → cấm push áp lực). Số liệu
> do CODE tính thật; AI chỉ viết **giọng văn** (động lực / câu nói hay / mẹo), không bịa.

### 13.1 Kênh & lên lịch

- **Discord webhook** (một chiều, không bot/OAuth). Tầng gửi tách ở `lib/notify/discord.ts` để sau
  dễ thêm Telegram/Slack. Webhook lưu trong DB (trang `/notifications`) hoặc fallback env `DISCORD_WEBHOOK_URL`.
- **Cron nội bộ**: `instrumentation.ts` → `lib/notify/scheduler.ts` (node-cron, tick **mỗi phút**, so giờ
  với cấu hình). Server always-on (Docker) nên scheduler sống cùng app, KHÔNG cần dịch vụ ngoài.
  `serverExternalPackages: ["node-cron"]` trong `next.config.ts`. Guard `NEXT_PHASE` để không chạy lúc build.
- **Endpoint fallback** `/api/notify/run?kind=&secret=&force=1` (POST/GET) cho scheduler ngoài / "Gửi thử".
  Bảo vệ bằng `NOTIFY_SECRET`; chưa đặt secret = endpoint TẮT.

### 13.2 Bốn loại (mỗi loại bật/tắt + giờ riêng)

1. **morning** (bản tin sáng): việc hôm nay, streak, "việc chính" (MIT, dùng `lib/priority`) + động lực/quote/tip.
2. **streak_guard**: CHỈ bắn khi `atRisk` && hôm nay chưa có việc done. Khung tích cực ("giữ thành quả"), không doạ.
3. **random_nudge**: tối đa **1/ngày**, mốc giờ seed theo NGÀY trong cửa sổ (`lib/notify/time`), bỏ qua nếu hết việc dở.
4. **evening** (đúc kết tối): điểm lại dịu dàng, gợi ý ghi chú; không phán xét phần chưa xong.

`intensity` (minimal | balanced | active) chỉ là **preset UI** đặt nhanh các toggle; runtime CHỈ đọc toggle + giờ.
Có **giờ yên** (vắt qua nửa đêm OK) chặn mọi thông báo. AI lỗi/không có key → **fallback tĩnh** (`lib/notify/fallback.ts`).

### 13.3 Dữ liệu & bất biến

- `NotificationSettings` (1 hàng `singleton`) + `NotificationLog` (idempotency 1/loại/ngày, lịch sử UI, để AI
  tránh lặp câu). `runNotification(kind,{force})` (`lib/notify/run.ts`) là orchestrator chung cho cron lẫn "Gửi thử";
  KHÔNG bao giờ ném lỗi — luôn ghi log. `force` bỏ qua enabled/giờ-yên/idempotency/gating.
- Dữ kiện (`lib/notify/context.ts`) truy ngược DB (streak động, MIT, kế hoạch chậm, capacity); embed gắn dòng số
  liệu thật dưới giọng văn để **minh bạch**. Prompt AI ở `lib/ai.ts` (`composeNotificationVoice`).

### 13.4 UI

- KHÔNG thêm tab thứ 5 (giữ quy ước 4 mục bottom bar §12). "Thông báo" = link icon ⓘ Bell ở **footer sidebar**
  + **top-bar mobile**. Trang `/notifications` (PageHeader + form + lịch sử) theo bộ card chuẩn §12; toggle dùng
  `components/ui/switch`. "Gửi thử" tự lưu cấu hình hiện tại trước khi bắn.

---

## 14. Lịch trình → Day Planner theo capacity

> KHÔNG phải Google Calendar. Là **tầng bối cảnh + xếp giờ**: cho bộ máy đề xuất biết **quỹ giờ rảnh
> thật** + **các khe trống** mỗi ngày → "khả thi" chính xác hơn, và để timeline đặt việc vào giờ. Lịch
> KHÔNG phải Task: **không** tính vào streak/stats/completion. AI **chỉ gợi ý** khe giờ (không tự áp đặt
> — minh bạch, §11); **server recompute + validate** khe AI trả (loại slot đè lịch cứng).

### 14.1 Mô hình (tất cả ĐO ĐỘNG ở `lib/schedule.ts`, KHÔNG cột tiến độ cứng; chuỗi ngày/giờ địa phương)

- **Lịch cứng** `Commitment` (lặp theo tuần: `dayOfWeek`, `startTime`/`endTime`, `kind` hoc|lam|khac,
  `active`) + **kỳ học** `validFrom`/`validUntil` (tự hết hạn) + `weekParity` null|odd|even (tuần chẵn/lẻ).
- **Khung mềm** `SoftBlock` (time-blocking, DỜI ĐƯỢC — cùng field + kỳ học): KHÔNG trừ quỹ rảnh cứng,
  chỉ giảm "quỹ gợi ý" của AI (`softLoadMinutes`).
- **Đột xuất** `ScheduleEvent` (`startTime` null = cả ngày; `cancels=true` = nghỉ cả ngày).
- **Cấu hình** `ScheduleSettings` (singleton: `wakeTime`/`sleepTime`/`bufferMin`/`minSlotMin`/
  `termAnchorMonday`) qua `lib/schedule-settings.ts`.
- Hàm lõi: `blocksForDate(date, commitments, events, anchorMonday?)` (lọc validity luôn + parity khi có
  anchor), `softBlocksForDate`, `computeFreeSlots(date, …, config)` → **danh sách khe trống** `{start,end,
  durationMin}` + `capacityMin` (nới buffer, kẹp giờ thức, bỏ khe < minSlot). `freeMinutes` = wrapper
  tương thích ngược (buffer 0). KHÔNG dùng `rrule` (lặp tuần + odd/even đủ).

### 14.2 Học thời lượng/năng lượng (mục 11 mở rộng)

- `Task` thêm `estimatedMinutes` (ước lượng), `deepWork` (ưu tiên khe sáng), `actualBucket`
  ("faster"|"asExpected"|"slower" — 1 chạm khi xong). `computeDifficultyHints` thêm `slowTopics`/
  `fastTopics`. Tất cả tùy chọn/1-chạm, KHÔNG phán xét.
- **Thói quen** `Habit` + `HabitCheck` (mục 11): 1-chạm, streak ĐỘNG (`lib/habits.ts`), **KHÔNG điểm**;
  cô lập khỏi Task stats/streak/`weeklyAvg`.

### 14.3 Tích hợp đề xuất (một luồng `/api/suggest`)

- `SuggestContext` thêm `freeSlotsTomorrow`, `suggestedCapacityMin` (= quỹ rảnh − softLoad),
  `preferredWindowsTomorrow`, `habitsToday`. `SuggestionItem` thêm `slotStart`/`estimatedMinutes`/
  `deepWork`. Prompt (quy tắc 15): xếp `slotStart` vào khe đủ dài, `deepWork`→khe sớm, tổng estimate ≤
  `suggestedCapacityMin`, KHÔNG đè lịch cứng. **Trust boundary** ở route: loại `slotStart` ngoài khe thật.
- Accept: `addTomorrowTask(…, extra)` set `scheduledFor`/estimate/deepWork; `scheduleTaskAt` đổi giờ việc đã có.
- Thông báo (mục 13): `NotificationFacts` có `todaySchedule` + `freeMinutesToday`.

### 14.4 UI

- **Trang Hôm nay** = trung tâm: toggle **Danh sách ⇄ Dòng giờ** (giữ qua `?view`; quá khứ ép List).
  `DayTimeline` (thanh giờ wake→sleep: lịch cứng khóa + khung mềm nét đứt + khe rảnh + việc đã xếp +
  đường now) + `CapacityBanner` (rảnh ~Xh, N khe, cảnh báo quá tải) + `SlotPicker` (xếp/đổi giờ, không
  drag-drop) + `HabitStrip` (1-chạm). Chế độ List giữ `ScheduleStrip` cũ.
- **Trang `/schedule`**: lưới tuần (lịch cứng + khung mềm nét đứt) + quản lý Lịch cứng / Khung tập trung /
  Thói quen + form "Giờ thức & quỹ thời gian". Dialog thêm/sửa chung 3 loại (commitment/soft/event) + khối
  "Kỳ học" gập lại. Vào qua link phụ — **KHÔNG thêm tab thứ 5** (giữ 4 tab §12).
- Màu: trung tính + viền trái nhạt theo `kind`; khung mềm = nét đứt + glyph Move; không accent chói (§12).

---

## 15. MCP Server (Claude đọc/ghi dữ liệu thật)

> Cho Claude (Claude.ai / Desktop / Cursor / VS Code) lập kế hoạch trực tiếp trên dữ liệu app qua
> **Model Context Protocol**. BẤT BIẾN: **logic AI ở phía Claude, không ở server** — server chỉ CRUD
> + cung cấp ngữ cảnh (lịch, workload, deadline). Single-user, không auth user.

### 15.1 Kiến trúc — chạy TRONG app Next
- Route **`app/api/[transport]/route.ts`** dùng `mcp-handler` (`createMcpHandler`, `basePath:"/api"`,
  `disableSse:true` → Streamable HTTP **stateless**, không cần Redis). Endpoint: `…/api/mcp`.
- **Cùng tiến trình** với app → chung `lib/db` Prisma + mọi `lib/*` helper; **1 process ghi SQLite**;
  deploy kèm container hiện có (không cần service/Traefik mới). `serverExternalPackages` thêm
  `mcp-handler`, `@modelcontextprotocol/sdk`.
- **Auth bắt buộc**: bearer `MCP_AUTH_TOKEN` (`lib/mcp/auth.ts`, đúng pattern `NOTIFY_SECRET`; chưa đặt
  token = endpoint tắt 403).

### 15.2 Data layer — `lib/mcp/repository.ts` (zod-validate, tái dùng `lib/*`)
CRUD task/project + `listTasks`, `getScheduleRange`, `getWorkloadSummary` (tái dùng
`lib/schedule.blocksForDate/busyMinutes/freeMinutes`, `lib/streak`). **Quy tắc đồng bộ BẮT BUỘC** (vì
app lọc theo `done`/`date`, KHÔNG theo `status`):
- set `scheduledFor` ⇒ set `date` = ngày địa phương (`lib/mcp/tz`, `DEFAULT_TIMEZONE`).
- `status=DONE`/`completeTask` ⇒ `done=true`+`completedAt`; status khác ⇒ `done=false`.
- `priority` (LOW/MEDIUM/HIGH/URGENT) ⇒ map `impact` (logic 80/20 của app).
- `delete_task` = **HARD delete** (không soft-delete: task CANCELLED sẽ lọt UI vì app không lọc status).
- Timezone: DB lưu UTC, MCP I/O ISO 8601, quy ngày theo `DEFAULT_TIMEZONE`.

### 15.3 Schema thêm (additive, nullable — mục 15, không phá dữ liệu)
Task thêm: `description?`, `status?`, `priority?`, `dueDate?`, `scheduledFor?`, `estimatedMinutes?`,
`projectId?`, `tags Tag[]`. Model mới **`Project`** (generic, RIÊNG với `Plan` roadmap-AI) + **`Tag`**.

### 15.4 Tools / Resources / Prompts (`lib/mcp/server.ts`)
- Tools: `ping`, `create_task`, `update_task`, `complete_task`, `delete_task`, `get_task`,
  `list_tasks`, `get_schedule`, `get_workload_summary`, `bulk_create_tasks`, `create_project`,
  `get_project`, `list_projects`. Description nhấn: `scheduledFor`≠`dueDate`; gọi `get_schedule`/
  `get_workload_summary` TRƯỚC khi xếp việc.
- Resources: `today_overview`, `active_projects`. Prompts: `plan_my_day`, `plan_week`, `plan_project`,
  `review_and_reschedule` — ép quy trình: đọc ngữ cảnh → trình bày kế hoạch → **chờ duyệt** → mới ghi.

### 15.5 Auth — bearer (Desktop/CLI) + OAuth 2.1 (Claude.ai web)
`checkMcpAuth` (`lib/mcp/auth.ts`) chấp nhận **cả hai**: static bearer `MCP_AUTH_TOKEN` (Claude
Desktop/Cursor/VS Code) **và** OAuth access JWT. 401 kèm `WWW-Authenticate: …resource_metadata=…`
để Claude.ai tự khởi động OAuth discovery.

**OAuth shim STATELESS** (`lib/mcp/oauth.ts` + `app/api/oauth/*`) — Claude.ai web chỉ hỗ trợ OAuth,
không cho nhập bearer:
- code/access/refresh đều là **JWT ký HMAC** (`jose`, khoá `MCP_OAUTH_SECRET` ?? `MCP_AUTH_TOKEN`) →
  KHÔNG cần bảng DB. PKCE **S256 bắt buộc**. Client công khai (DCR `/register` cấp `client_id`, không secret).
- **Consent gate** ở `/api/oauth/authorize`: chủ nhân nhập `MCP_AUTH_TOKEN` để xác nhận → cấp code.
- Discovery `/.well-known/oauth-authorization-server` + `/.well-known/oauth-protected-resource` qua
  `next.config` rewrites (Next bỏ qua thư mục dấu chấm). Metadata/token/register có CORS + OPTIONS.
- ⚠️ **Bug Anthropic (6/2026)**: claude.ai web có lúc hoàn tất OAuth nhưng không đính Bearer vào request
  MCP (401 loop). Server đã đúng chuẩn; nếu trúng bug thì chờ Anthropic sửa hoặc dùng Desktop/Cursor.

### 15.6 Triển khai
Đặt env trong compose phía server `/opt/apps/todo/docker-compose.yml`: `MCP_AUTH_TOKEN` (bắt buộc),
`MCP_OAUTH_SECRET` (nên đặt riêng), `DEFAULT_TIMEZONE`. Connector: `https://<domain>/api/mcp`
(Desktop/CLI kèm bearer; Claude.ai web tự chạy OAuth).
