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

> **§10–§17 = đặc tả tính năng.** Chi tiết đầy đủ tách sang **`docs/04-features-spec.md`** (đọc khi đụng
> đúng tính năng). Dưới đây CHỈ giữ tóm tắt + **bất biến** không được vi phạm. §12 (UI shell) và §16
> (vai trò tab) vẫn nằm nguyên ở đây vì là quy ước áp dụng thường xuyên.

## 10. Kế hoạch (Plan) — mục tiêu dài hạn

> **Chi tiết: `docs/04-features-spec.md` §10.** Tóm tắt + bất biến:

- **Roadmap cuốn chiếu**: AI sinh milestone lúc tạo; task hằng ngày rót 1–2 việc/ngày theo vị trí trên
  roadmap + tốc độ thật — **KHÔNG đẻ sẵn 30 ngày**. Hòa vào `/api/suggest` (nhóm `plan_tasks`), không
  luồng riêng. Nhiều plan song song → chia đều theo `avgDonePerDay`.
- **Tiến độ ĐỘNG** (`lib/plan.ts`, không lưu cột `progress`/`behindDays`). Model `Plan`+`Milestone`;
  Task chỉ thêm `planId?`/`milestoneId?`.
- **Bất biến (§10.8):** sức chứa = `avgDonePerDay` (intensity chỉ gợi ý mềm); **user tự tick milestone**
  (AI chỉ gợi ý); **tạo plan xong KHÔNG tự đẻ task**. Chậm → cảnh báo + đưa lựa chọn, không tự co giãn ngầm.

## 11. Tầng hành vi học (Behavioral layer) — BẤT BIẾN

> **Chi tiết: `docs/04-features-spec.md` §11.** Nguyên tắc trung tâm (KHÔNG vi phạm):

- App tối ưu **xác suất duy trì lâu dài, không kiệt sức** — KHÔNG tối ưu số task xong. Mọi cơ chế mới qua
  3 cửa: ma sát thấp (input tùy chọn/1-chạm) · minh bạch (reason truy về data thật) · đạo đức (regret test).
- **LÀM:** calibrate theo actuals, học độ khó từ emotion → chia nhỏ việc hay trượt, if-then cue,
  self-compassion, streak loss-soft (ân hạn 1 ngày), 80/20 + 1 MIT, goal-gradient, reward = feedback thông tin.
- **KHÔNG:** XP/level/badge/điểm gắn vào hoàn thành, variable reward, phạt, push gây lo âu
  (_overjustification_ d≈−0.34). Độ khó/capacity suy ĐỘNG (`lib/difficulty.ts`/`lib/capacity.ts`);
  task chia nhỏ = subtask (`parentId`), task cha là container — KHÔNG tính stats/streak.

---

## 12. Quy ước giao diện (UI shell & layout) — BẮT BUỘC

> Đại tu 2026-06: app dùng **app-shell** thay nav ngang. Giữ trung tính kiểu Notion nhưng tận dụng
> desktop, ít ngợp. Dựa trên nghiên cứu (NN/g, Refactoring UI). Mọi trang/feature mới phải bám.
> **Nền chung:** §12 là lớp quy ước RIÊNG của `todo`, CHỒNG LÊN chuẩn kỹ thuật chung skill `/react-ui-craft`
> (quy trình 7 bước + quality floor + composition + UX states + security — xem `MiniServer/CLAUDE.md`). Khi
> hai bên trùng, theo §12 (cụ thể hơn cho app này); phần §12 không nói tới, theo react-ui-craft.

- **Khung (đại tu 2026-06):** `components/app-shell.tsx` bọc toàn app (render ở `layout.tsx`).
  Desktop ≥`lg`: **sidebar trái 7 mục** thu gọn được, nhóm 3 cụm (Hằng ngày: Hôm nay/Lịch tuần/Kế
  hoạch/Nhịp sống · Nhìn lại: Lịch sử · Hệ thống: Thông báo/Hướng dẫn) + footer chip streak + theme.
  Mobile <`lg`: **top-bar mỏng** (brand + streak + icon Thông báo/Hướng dẫn + theme) + **bottom tab
  bar 5 mục** (Hôm nay · Lịch · Kế hoạch · Nhịp sống · Lịch sử — luôn hiện, KHÔNG hamburger). Chip
  streak tách ở `components/streak-chip.tsx`. (Trước 2026-06 là 4 tab; đã nâng lên 5 + đưa lịch/thông
  báo lên sidebar.)
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
- **Motion = Motion v12** (`motion`, `import { motion, AnimatePresence } from "motion/react"`) theo chuẩn
  chung `/react-ui-craft` (`references/motion.md`) — **đã BỎ lệnh cấm framer-motion (chốt 2026-06; trước
  đây §12 cấm)**. File dùng `motion.*` cần `"use client"` — giữ ranh giới đó NHỎ (bọc đúng phần động, không
  cả trang). Vẫn ưu tiên TIẾT CHẾ (đúng tinh thần motion.md): micro-interaction nhẹ vẫn nên dùng CSS thuần
  (`transition-colors`, `active:scale-*`); CHỈ animate `transform`/`opacity`; mỗi màn 1 khoảnh khắc đáng
  chú ý; 150–250ms micro / 300–500ms entrance; dùng cùng easing/duration toàn app (`MotionConfig`).
  Cuộn-hiện: `components/reveal.tsx` hoặc `whileInView` (`viewport={{ once: true }}`). LUÔN tôn trọng
  `prefers-reduced-motion` (`MotionConfig reducedMotion="user"` / `useReducedMotion`; guard global đã có).
  View Transitions vẫn dùng được cho chuyển trang.
- **Màu:** trung tính thuần; chỉ dùng màu **ngữ nghĩa** (amber quá hạn, emerald xong/phục hồi, rose mệt).
  Hành động chính = nút `default` (đen/trắng). KHÔNG thêm accent thương hiệu, KHÔNG gradient.
- **iPhone / mobile (chốt 2026-06):** `layout.tsx` export `viewport` với `viewportFit: "cover"`. Bottom
  tab bar `pb-[env(safe-area-inset-bottom)]`, top-bar `pt-[env(safe-area-inset-top)]`, main mobile
  `pb-[calc(env(safe-area-inset-bottom)+5rem)]` — KHÔNG để bar đè home-indicator. Tap target ≥ ~44px
  (tab bar `min-h-12`; nút cảm ứng nhỏ nới `size-9 sm:size-7`). Giữ look trung tính (không large-title,
  không inset-grouped).
- **shadcn:** `sheet`, `scroll-area`, `switch`, `tabs`, `calendar`, `popover` (unified `radix-ui`, style
  radix-nova `data-open/closed`).
- **Primitive dùng chung (BẮT BUỘC tái dùng, đại tu 2026-06):**
  - **`components/ui/date-picker.tsx`** (Popover + Calendar, value `"YYYY-MM-DD"` địa phương) +
    **`components/ui/time-picker.tsx`** (gõ tay + dropdown mốc 15′, value `"HH:MM"`). **MỌI** chỗ nhập
    ngày/giờ dùng 2 cái này — KHÔNG `<input type="date"/"time">` thô.
  - **`components/field.tsx`** (`Field`: nhãn + control `w-full` + hint/info) cho mọi form trong
    `grid gap-3 sm:grid-cols-2` → ô bằng nhau, fill grid.
  - **`components/icon-tooltip.tsx`** (`IconTooltip`) cho gợi ý read-only của nút-icon — KHÔNG `title=`.
    Giải thích khái niệm dài vẫn dùng `InfoHint` (Popover, click).
  - **`PageHeader` prop `info`** → InfoHint cạnh tiêu đề (bỏ description dài, giữ tiêu đề sạch).
  - **`components/skeletons.tsx`** + mỗi route có **`loading.tsx`** → chuyển trang không khựng.
- **Tabs cho trang nhiều mục:** `/notifications` (Cài đặt | Lịch sử), `/guide` (Dùng app | Dùng với AI/MCP).
- **`/schedule` = lưới giờ kéo-thả** (`components/schedule/week-grid.tsx` + `lib/schedule-grid.ts`):
  kéo-tạo + kéo-dời/resize bằng Pointer Events thuần (KHÔNG drag-lib), snap 15′, chạm + chuột. Move/resize
  gửi lại đầy đủ field (giữ parity/validity). Thói quen + Giờ thức/quỹ giờ tách sang **`/routines`** (Nhịp sống).

---

## 13. Thông báo Discord thông minh

> **Chi tiết: `docs/04-features-spec.md` §13.** Bất biến (§11): thông báo **nâng đỡ, không hối thúc,
> không gây lo âu**. CODE tính số liệu thật; AI chỉ viết **giọng văn** (không bịa).

- Discord webhook một chiều (`lib/notify/discord.ts`). Cron nội bộ `instrumentation.ts` →
  `lib/notify/scheduler.ts` (node-cron, tick mỗi phút). Endpoint fallback `/api/notify/run` gác `NOTIFY_SECRET`.
- 5 loại (mỗi loại toggle + giờ riêng): **morning · streak_guard · random_nudge · evening · queue_nudge** (§17).
  Có **giờ yên**. `runNotification(kind,{force})` (`lib/notify/run.ts`) KHÔNG bao giờ ném lỗi; AI lỗi → fallback tĩnh.

## 14. Lịch trình → Day Planner theo capacity

> **Chi tiết: `docs/04-features-spec.md` §14.** KHÔNG phải Google Calendar — là **tầng bối cảnh + xếp giờ**.

- Lịch KHÔNG phải Task: **không** tính streak/stats/completion. AI **chỉ gợi ý** khe giờ; **server recompute
  + validate** (loại slot đè lịch cứng — trust boundary).
- Model (ĐO ĐỘNG ở `lib/schedule.ts`): `Commitment` (lịch cứng lặp tuần + kỳ học + tuần chẵn/lẻ) · `SoftBlock`
  (khung mềm, dời được) · `ScheduleEvent` (đột xuất) · `ScheduleSettings` (giờ thức/buffer/minSlot).
  `computeFreeSlots` → khe trống + `suggestedCapacityMin`. Task học `estimatedMinutes`/`deepWork`/`actualBucket`;
  thói quen `Habit`/`HabitCheck` cô lập khỏi task. Tích hợp `/api/suggest` (slotStart/estimate/deepWork).

## 15. MCP Server (Claude đọc/ghi dữ liệu thật)

> **Chi tiết: `docs/04-features-spec.md` §15.** BẤT BIẾN: **logic AI ở phía Claude, không ở server** —
> server chỉ CRUD + cung cấp ngữ cảnh. Single-user; auth bearer `MCP_AUTH_TOKEN` (+ OAuth shim cho claude.ai).

- Chạy TRONG app Next: route `app/api/[transport]/route.ts` (`mcp-handler`, Streamable HTTP stateless),
  endpoint `…/api/mcp`. Cùng tiến trình → chung `lib/db` + `lib/*`; 1 process ghi SQLite.
- **Quy tắc đồng bộ BẮT BUỘC** (`lib/mcp/repository.ts`, vì app lọc theo `done`/`date` chứ không `status`):
  set `scheduledFor` ⇒ set `date` địa phương; `status=DONE` ⇒ `done=true`; `delete_task` = HARD delete;
  date contract khoan dung (nhận cả `YYYY-MM-DD` lẫn ISO). ⚠️ `Project` **đã gỡ khỏi MCP** → dùng **Plan**.
- Tools/Resources/Prompts ở `lib/mcp/server.ts` (task · plan/milestone · habit · queue §17). Prompt ép quy
  trình: đọc ngữ cảnh → trình bày → **chờ duyệt** → mới ghi; tôn trọng `suggestedFreeMinutes`.

---

## 16. Vai trò từng tab — đặt tên & dạy MCP/AI (BẤT BIẾN, chốt 2026-06)

> Mỗi tab có **một** vai trò + **một** tên. Không khái niệm vô hình, không tên trùng. Đây là nguồn sự
> thật để (a) đặt nhãn UI, (b) viết mô tả tool/prompt MCP sao cho AI map đúng. Lý do ra đời: AI tạo "kế
> hoạch" qua MCP nhưng dữ liệu rải vào cả Lịch sử lẫn Kế hoạch, và `Project` (MCP) thì vô hình.

| Tab                   | Route                      | Vai trò DUY NHẤT                                                                                                                                                    |
| --------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hôm nay               | `/`                        | Thực thi **trong ngày**: việc hôm nay, tiêu điểm, đề xuất ngày mai.                                                                                                 |
| Lịch tuần             | `/schedule`                | **Lịch CỨNG lặp tuần** (học/làm) + khung tập trung → quỹ giờ thật. KHÔNG phải todo.                                                                                 |
| **Kế hoạch**          | `/plans`                   | **MỤC TIÊU DÀI HẠN**: roadmap + cột mốc + tiến độ (`Plan`/`Milestone`). **Nơi DUY NHẤT** mang nghĩa "kế hoạch"; chỗ xem tổng quan một kế hoạch (`/plans/[id]`).     |
| **Ấp ủ**              | `/incubating`              | **MỤC TIÊU CHƯA CAM KẾT** (Someday/Maybe — `Goal`): bắt giữ không áp lực. Ngõ ra: kéo thành Việc / nâng thành Kế hoạch / buông. **Nơi DUY NHẤT** mang nghĩa "ấp ủ". |
| Nhịp sống             | `/routines`                | Thói quen lặp + giờ thức/ngủ + quỹ giờ.                                                                                                                             |
| Lịch sử               | `/history`                 | **Nhìn lại**: ngày đã qua, streak, tỉ lệ + "Việc sắp tới". **KHÔNG dùng từ "kế hoạch"** ở đây.                                                                      |
| Thông báo / Hướng dẫn | `/notifications`, `/guide` | Hệ thống.                                                                                                                                                           |

**Quy ước tên (BẮT BUỘC):**

- "Kế hoạch" = **chỉ** trang `/plans` (mục tiêu dài hạn). Trang khác KHÔNG được dùng từ này (Lịch sử dùng
  "Việc sắp tới", không "Kế hoạch sắp tới").
- "Việc/task" = đơn vị hằng ngày (có `date`/`scheduledFor`) → Hôm nay/Lịch sử. "Lịch" = `Commitment`/
  `SoftBlock` lặp tuần (KHÔNG phải task) → Lịch tuần.
- "Ấp ủ" = **chỉ** trang `/incubating` (mục tiêu CHƯA cam kết — chưa có ngày, chưa có roadmap). Không
  trang nào khác dùng từ này. Ấp ủ KHÁC "Kế hoạch" (đã có roadmap) và "Việc" (đã có ngày).

**Map MCP/AI (để không hiểu sai):**

- Mục tiêu nhiều bước / dài hạn → **Plan** (`create_plan` + milestones). KHÔNG có Project (đã gỡ, §15.3).
- Việc của một ngày → `create_task`/`bulk_create_tasks` (ngày cụ thể). Lịch cứng → `get_schedule` (đọc
  bối cảnh, không tạo task). Tạo Plan xong **KHÔNG tự đẻ task** (§10.8) — task rót cuốn chiếu.
- Mục tiêu người dùng MUỐN làm nhưng CHƯA chốt khi nào / chưa rõ task hay plan → **Ấp ủ** (`add_to_queue`).
  Khi sẵn sàng: `promote_to_task` (việc gọn) hoặc `promote_to_plan` (mục tiêu nhiều bước). KHÔNG tự buông.

---

## 17. Ấp ủ — hàng đợi mục tiêu chưa cam kết (Someday/Maybe)

> **Chi tiết: `docs/04-features-spec.md` §17.** Tầng tiền-cam-kết (GTD Someday/Maybe). Route `/incubating`,
> model `Goal`, logic `lib/queue.ts`. KHÁC `Task` (đã có ngày) và `Plan` (đã có roadmap).

- `Goal` (`title`, `note?`, `status`, `pinned`, `snoozedUntil?`, `promotedTaskId?`/`promotedPlanId?`) —
  KHÔNG có `date`, **cô lập** khỏi streak/stats. Tính ĐỘNG: `goalAgeDays`/`isStale`/`rankGoalsForNudge`.
- Bắt giữ 1 chạm (chỉ `title`). **3 ngõ ra:** kéo thành Việc / nâng thành Kế hoạch / buông (soft, khôi phục được).
  **AI chỉ gợi ý, người dùng quyết** — KHÔNG tự nâng/tự buông.
- "Nhắc khi rảnh" đã tích hợp (không luồng riêng): `/api/suggest` nhóm `queue_pulls` · thẻ Today
  `incubating-nudge` · Discord `queue_nudge` (§13). MCP (§15): `add_to_queue`/`list_queue`/`update_goal`/
  `drop_goal`/`promote_to_task`/`promote_to_plan`.
