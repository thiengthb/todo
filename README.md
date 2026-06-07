# Smart Todo

Todo list cá nhân thông minh: tạo task trong ngày, đánh dấu xong và chấm cảm xúc
(dễ / bình thường / mệt). Cuối ngày bấm **"Đề xuất todo cho ngày mai"** —
AI đọc lịch sử thật (việc xong, việc dở, mức trì hoãn, cảm xúc, tốc độ hoàn thành)
và đề xuất danh sách **khả thi** kèm **lý do** cho từng việc.

> Spec đầy đủ & rule phát triển: xem `CLAUDE.md`.

## Stack

Next.js (App Router, TypeScript) · Tailwind + shadcn/ui · Prisma + SQLite · Gemini API (JSON mode)

## Cài đặt & chạy

```bash
npm install

# 1. Cấu hình môi trường
cp .env.example .env
#    Điền AI_API_KEY (lấy free tại https://aistudio.google.com/apikey)

# 2. Tạo database SQLite
npx prisma migrate dev

# 3. Chạy
npm run dev          # http://localhost:3000
```

## Lịch sử & kế hoạch

- **Day View** (`/?date=YYYY-MM-DD`): điều hướng ← → giữa các ngày ngay trên trang chính.
  Quá khứ = chế độ quan sát (kết quả, cảm xúc, ghi chú — không thêm việc ngược thời gian);
  tương lai = chế độ lập kế hoạch (thêm task trước).
- **`/history`**: dải hoạt động 14 ngày (tỉ lệ hoàn thành), section "Kế hoạch sắp tới"
  và timeline "Đã qua" với progress bar + cảm xúc + note từng ngày. Click ngày nào → Day View ngày đó.

## Cấu trúc chính

```
app/page.tsx              Day View (hôm nay + mọi ngày qua ?date=)
app/history/page.tsx      toàn cảnh: dải 14 ngày, kế hoạch sắp tới, lịch sử
app/actions.ts            server actions CRUD (task, note, thêm vào ngày mai)
app/api/suggest/route.ts  lắp ngữ cảnh từ DB → gọi AI → trả JSON đúng hợp đồng
lib/db.ts                 Prisma client singleton
lib/ai.ts                 gọi Gemini + system prompt + parse/validate JSON
lib/dates.ts              helper ngày (local-time, tính mức trì hoãn động)
components/today/         các mảnh UI của màn hình Hôm nay
```

## Deploy lên miniserver (Docker + auto-deploy)

Push lên `main` (có thay đổi trong `todo/`) → GitHub Actions build và redeploy
qua **self-hosted runner** trên miniserver (cùng runner với link-manager).
Workflow: `.github/workflows/deploy-todo.yml`.

- App chạy ở cổng **3002** (3001 đã thuộc link-manager). DB SQLite nằm trong
  volume `todo_data` — sống qua mọi lần redeploy.
- Mỗi đợt deploy, service `migrate` (one-shot) tự chạy `prisma migrate deploy`
  trước, app chỉ khởi động khi migrate thành công — đổi schema không cần làm gì tay.
- `TZ=Asia/Ho_Chi_Minh` được set trong compose để "hôm nay" tính đúng theo giờ VN.
- Secrets cần đặt trong GitHub (Settings → Secrets and variables → Actions):
  - Secret `AI_API_KEY` — key Gemini
  - Variable `AI_MODEL` (tuỳ chọn, mặc định `gemini-2.5-flash`)
- Deploy tay không qua git: `AI_API_KEY=... docker compose up -d --build`
- Backup: `docker run --rm -v todo_todo_data:/data -v $(pwd):/backup alpine cp /data/todo.db /backup/`

> Lưu ý Windows/macOS dev: nếu sửa dependency, chạy
> `docker run --rm -v ${PWD}:/app -w /app node:24-alpine npm install --package-lock-only`
> để lockfile ghi đủ optional deps cho Linux (tránh `npm ci` fail trong image).

## Ghi chú vận hành

- Dữ liệu nằm trong `prisma/dev.db` (đã gitignore) — backup = copy file.
- Mức trì hoãn không lưu cứng; tính từ `carriedFrom`/ngày tạo đến hôm nay.
- Carry-over qua nút "Ngày mai" trong dialog đề xuất sẽ giữ chuỗi `carriedFrom`
  gốc — task lười không bao giờ "reset" được số ngày trì hoãn 😉.
- `scripts/smoke-test.cjs` — bơm nhanh dữ liệu mẫu khi cần thử:
  `DATABASE_URL="file:<đường dẫn tuyệt đối tới prisma/dev.db>" node scripts/smoke-test.cjs`
