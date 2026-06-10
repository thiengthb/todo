# Smart Todo

Todo list cá nhân thông minh: tạo task trong ngày, đánh dấu xong và chấm cảm xúc
(dễ / bình thường / mệt). Cuối ngày bấm **"Đề xuất todo cho ngày mai"** —
AI đọc lịch sử thật (việc xong, việc dở, mức trì hoãn, cảm xúc, tốc độ hoàn thành)
và đề xuất danh sách **khả thi** kèm **lý do** cho từng việc.

> 📚 Tài liệu đầy đủ trong [`docs/`](./docs/): [sản phẩm](./docs/01-product.md) ·
> [kỹ thuật](./docs/02-technical.md) · [hướng dẫn sử dụng](./docs/03-user-guide.md).
> Trang hướng dẫn tương tác trong app: `/guide`. Spec & rule phát triển: `CLAUDE.md`.

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

## Thông báo Discord (mục 13)

Nhắc chủ động qua Discord, giọng nâng đỡ (không hối thúc): **bản tin sáng**, **nhắc giữ streak**
khi sắp đứt chuỗi, **cú hích ngẫu nhiên** làm việc, và **đúc kết tối**. Số liệu (streak, số việc,
việc chính) do hệ thống tính thật; AI chỉ thêm động lực / câu nói hay / mẹo.

- Cấu hình tại **`/notifications`**: dán Webhook URL, chọn cường độ, bật/tắt + đặt giờ từng loại,
  giờ yên, và bấm **"Gửi thử"**. Lấy webhook: kênh Discord → ⚙ → Tích hợp → Webhook → Sao chép URL.
- Lên lịch bằng **cron nội bộ** (`instrumentation.ts` + node-cron, tick mỗi phút) — chạy cùng server
  always-on, không cần dịch vụ ngoài. Giờ tính theo `TZ` (prod = `Asia/Ho_Chi_Minh`).
- Fallback gọi ngoài: `POST /api/notify/run?kind=morning&secret=$NOTIFY_SECRET` (đặt `NOTIFY_SECRET`
  để bật; thêm `&force=1` để gửi ngay, bỏ qua điều kiện). Không có `AI_API_KEY` → vẫn chạy với nội dung tĩnh.

## Lịch trình (mục 14)

Khai báo **lịch cứng** (học, làm) lặp theo tuần + **việc đột xuất** tại **`/schedule`**. Đây không
phải lịch để "làm cho xong" mà là **bối cảnh**: app biết quỹ giờ rảnh thật mỗi ngày nên đề xuất việc
vừa sức hơn và gắn `cue` vào khe trống. Lịch cứng không tính vào chuỗi/thống kê.

- Lưới tuần (T2–CN) + quản lý lịch cứng (bật/tắt, sửa, xoá). Buổi đột xuất có thể "có giờ", "cả ngày",
  hoặc "nghỉ" (bỏ qua lịch cứng hôm đó).
- Trang **Hôm nay** hiện dải lịch của ngày + quỹ giờ rảnh; **bản tin sáng** (Discord) nhắc khéo lịch.
- AI **chỉ gợi ý** nhét việc vào khe trống — không tự xếp lịch (giữ minh bạch).

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
- **Thông báo Discord**: cách gọn nhất là dán Webhook URL ngay trong app tại
  `/notifications` (lưu vào DB trên volume `todo_data`, sống qua mọi redeploy) —
  KHÔNG cần đụng tới hạ tầng. Nếu muốn dùng biến môi trường thay thế, thêm
  `DISCORD_WEBHOOK_URL` (và `NOTIFY_SECRET` để bật endpoint ngoài) vào khối
  `environment:` của compose phía server `/opt/apps/todo/docker-compose.yml`.
  Lưu ý: workflow CI hiện chỉ build & push image — KHÔNG bơm secret runtime vào
  container, nên đặt secret trong GitHub Actions sẽ không tới được app.
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
