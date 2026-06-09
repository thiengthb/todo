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
- **shadcn:** đã thêm `sheet`, `scroll-area` (unified `radix-ui`, style radix-nova `data-open/closed`).
