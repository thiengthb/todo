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
    { "title": "string", "priority": "high|medium|low", "reason": "string ngắn" }
  ],
  "suggested_tasks": [
    { "title": "string", "priority": "high|medium|low", "reason": "string ngắn" }
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