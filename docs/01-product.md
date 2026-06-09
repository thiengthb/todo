# 01 — Tài liệu sản phẩm

## 1. Smart Todo là gì

Một **todo list cá nhân thông minh** cho một người dùng (chính chủ). Bạn tạo việc trong ngày,
đánh dấu xong và **chấm cảm xúc** (dễ / bình thường / mệt). Cuối ngày bấm một nút, **AI đọc lịch sử
thật** của bạn và đề xuất danh sách **khả thi** cho ngày mai, kèm **lý do** cho từng việc.

Khác biệt cốt lõi so với Todoist/TickTick/Notion: app không chỉ _lưu việc_, nó **học cách bạn thực
sự làm việc** (tốc độ, độ khó cảm nhận, mức trì hoãn, năng lượng) và điều chỉnh đề xuất theo đó.

## 2. Nguyên tắc trung tâm (bất biến)

> App KHÔNG tối ưu _số task hoàn thành_, mà tối ưu **xác suất người dùng còn duy trì kế hoạch sau
> nhiều năm mà không kiệt sức**.

Mọi tính năng phải qua 3 cửa:

1. **Ma sát thấp** — input mới luôn _tùy chọn / 1 chạm / bỏ qua được_; AI vẫn chạy tốt khi thiếu dữ liệu.
2. **Minh bạch** — mỗi đề xuất của AI có `reason` ngắn, **truy ngược được về dữ liệu thật**.
3. **Đạo đức** — qua "regret test" (người dùng có hối tiếc vì cú hích này không?); không dark pattern,
   không gây nghiện, không gây lo âu.

## 3. Người dùng & phạm vi

- **Một người dùng** — không đăng nhập, không multi-tenant, không phân quyền.
- Mục tiêu đa dạng: **học/phát triển kỹ năng, công việc/dự án, thói quen/sức khỏe** — trộn lẫn được.
- Nhẹ, nhanh: chạy `npm run dev`, dữ liệu trong 1 file SQLite.

## 4. Luồng hoạt động

### 4.1 Một ngày điển hình (vòng lặp ngắn)

```
            ┌─────────────────────────────────────────────────────┐
            │                     TRANG HÔM NAY                    │
            └─────────────────────────────────────────────────────┘
   Thêm việc ──▶ Làm & tick xong ──▶ Chấm cảm xúc (dễ/bình thường/mệt)
       │                                          │
   (tùy chọn) Check-in: năng lượng/tâm trạng/      │  (chỉ mở khi đã xong —
    stress/giấc ngủ + ghi chú cuối ngày            │   chấm việc chưa làm là vô nghĩa)
       │                                          ▼
       └────────────▶  Bấm "Đề xuất todo cho ngày mai"
                                   │
                                   ▼
                  AI đọc TẤT CẢ dữ liệu thật → trả JSON có cấu trúc
                  (carry-over, việc mới, việc theo kế hoạch, cảnh báo)
                                   │
                                   ▼
                  Bạn chọn việc nào "Thêm vào ngày mai"  ◀── bạn vẫn là người quyết
```

### 4.2 Vòng lặp học (dài hạn)

Mỗi ngày trôi qua, dữ liệu thật dày thêm → đề xuất ngày càng đúng "tạng" của bạn:

```
   Việc + cảm xúc + tốc độ + năng lượng (hôm nay)
                  │   tích lũy
                  ▼
   AI hiệu chỉnh: độ khó từng loại việc · sức/ngày · việc hay trượt
                  │
                  ▼
   Đề xuất ngày mai sát thực tế hơn → bạn hoàn thành nhiều hơn → dữ liệu tốt hơn
                  └───────────────── lặp lại ─────────────────┘
```

### 4.3 Kế hoạch dài hạn (roadmap cuốn chiếu)

Với mục tiêu lớn ("Học tiếng Nhật trong 1 tháng"), app **không** đẻ sẵn lịch cứng 30 ngày (lệch là
chất đống việc quá hạn → nản). Thay vào đó:

```
   Mục tiêu ──▶ AI chia thành ROADMAP cột mốc (bạn chỉnh được)
                  │  Tuần1 Hiragana → Tuần2 Katakana → Tuần3 từ vựng → Tuần4 câu đơn
                  ▼
   Mỗi ngày: "Đề xuất ngày mai" RÓT 1–2 việc kế tiếp của cột mốc hiện tại,
             bám tốc độ thật. Đi nhanh → đẩy tới; chậm → cảnh báo + cho bạn chọn
             (giãn deadline / bỏ bớt mốc / tăng tốc).
```

## 5. Các tính năng & cơ chế

| Tính năng                  | Làm gì                                        | Phục vụ điều gì                                 |
| -------------------------- | --------------------------------------------- | ----------------------------------------------- |
| **Chấm cảm xúc**           | 1 chạm sau khi xong việc (dễ/bình thường/mệt) | Tín hiệu độ khó cảm nhận, gần như 0 ma sát      |
| **Đề xuất ngày mai**       | AI trả danh sách khả thi + lý do              | Bỏ gánh nặng "hôm nay làm gì"                   |
| **Chia nhỏ việc**          | AI tự bẻ việc lớn/hay trượt thành các bước    | Hạ rào cản, tạo đà (tick từng bước)             |
| **Việc chính (MIT)**       | Nổi bật 1 việc đáng làm nhất                  | Ưu tiên 80/20                                   |
| **Cue "khi nào/ở đâu"**    | Gắn ý định thực hiện cho việc quan trọng      | Tăng mạnh khả năng làm thật                     |
| **Kế hoạch + cột mốc**     | Mục tiêu dài hạn, roadmap cuốn chiếu          | Tiến bộ bền vững theo tốc độ thật               |
| **Chuỗi giữ lửa (streak)** | Đếm ngày liên tục, **ân hạn 1 ngày**          | Động lực mềm, không trừng phạt                  |
| **Check-in & sức/ngày**    | Năng lượng/tâm trạng/stress/ngủ → "capacity"  | AI giảm tải, đề xuất **ngày phục hồi** khi đuối |
| **Lý do trượt**            | 1 chạm ghi vì sao việc bị hoãn                | AI học để chia nhỏ / giảm tải                   |
| **Phản chiếu**             | Câu ngắn về thói quen từ dữ liệu thật         | Cảm giác năng lực + danh tính                   |

## 6. Nền tảng khoa học (đã chắt lọc, có trích dẫn)

Tính năng được chọn theo tiêu chí **bằng chứng mạnh × ma sát thấp**, và **loại bỏ** thứ phản tác dụng.

### 6.1 Những thứ ĐÃ áp dụng

- **Planning fallacy** — người ta ước lượng quá lạc quan; chỉ ~30% việc xong đúng hạn tự đặt
  (Buehler/Kahneman). Cách chữa = "outside view" / **reference-class**: bám số liệu thật của chính
  mình. → App dùng tốc độ & cảm xúc thật để hiệu chỉnh số lượng và độ khó việc.
  ([Planning fallacy — Wikipedia](https://en.wikipedia.org/wiki/Planning_fallacy))
- **Implementation intentions** (kế hoạch "khi–thì", nơi chốn) — một trong những can thiệp mạnh & rẻ
  nhất, **d ≈ 0.65** trên ~94 nghiên cứu (Gollwitzer & Sheeran). → Trường **cue** tùy chọn cho việc
  quan trọng. ([Meta-analysis — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC8149892/))
- **Mục tiêu gần > mục tiêu xa** (Bandura & Schunk 1981): cột mốc gần thúc đẩy mạnh, mục tiêu xa "không
  có tác dụng rõ rệt" một mình. → Dồn UI vào cột mốc kế + 2–5 việc hôm nay, không nhồi tầng kế hoạch
  rườm rà. ([Bandura & Schunk, JPSP 1981](https://uploads-ssl.webflow.com/59faaf5b01b9500001e95457/5bc552d85141987915dab842_Bandura%20&%20Schunk,%201981.pdf))
- **Self-compassion** khi vấp (Breines & Chen 2012): tự tử tế _tăng_ động lực cải thiện, _giảm_ trì
  hoãn — ngược với lo ngại "nuông chiều". → Giọng văn trung tính/tử tế khi trượt, "co nhỏ + bắt đầu
  lại" thay vì trách móc. ([Breines & Chen, PSPB 2012](https://journals.sagepub.com/doi/abs/10.1177/0146167212445599))
- **Thói quen & ân hạn 1 ngày** (Lally 2010; "never miss twice" — Atomic Habits): bỏ _một_ ngày không
  hại sự tự động hoá; chỉ bỏ _hai_ ngày liên tiếp mới nguy. → Streak tha thứ 1 ngày hở.
  ([Lally — University of Surrey](https://www.surrey.ac.uk/news/does-it-really-take-66-days-form-habit-we-asked-expert-dr-pippa-lally))
- **80/20 (Pareto)** — ưu tiên theo _giá trị ÷ công sức_; nổi bật **một việc chính (MIT)**.
- **Goal-gradient** (Kivetz 2006): càng gần đích càng nỗ lực; nên nhấn _quãng đường còn lại_ ("còn 2
  việc") hơn là "% đã đi". ([Kivetz, Urminsky & Zheng 2006](https://journals.sagepub.com/doi/abs/10.1509/jmkr.43.1.39))
- **Streak loss-soft** (Silverman & Barasch 2022): chuỗi mạnh nhờ tâm lý sợ mất, nhưng tự-trách khi đứt
  làm hại — cần _ân hạn/sửa chữa_ và đổ lỗi cho lịch, không cho người.
  ([J. Consumer Research 2022](https://academic.oup.com/jcr/article/49/6/1095/6623414))
- **Identity-as-evidence** (Self-Perception; Atomic Habits): phản chiếu pattern thật ("5/7 ngày bạn
  giữ nhịp — giống một thói quen") thay vì bắt người dùng tự nhận vai.

### 6.2 Những thứ CHỦ ĐÍCH KHÔNG làm (vì phản tác dụng)

- **Điểm/XP/level/badge gắn vào hoàn thành task, variable reward, phạt.** Phần thưởng ngoại lai _bào
  mòn_ động lực nội tại với việc thú vị — **d ≈ −0.34** trên 128 nghiên cứu (Deci, Koestner & Ryan
  1999, "overjustification effect"). Với app tự-phát-triển, động lực nội tại bền mới là thứ cần giữ →
  mọi "thưởng" được chuyển thành **feedback thông tin**.
  ([Deci, Koestner & Ryan 1999](https://home.ubalt.edu/tmitch/642/articles%20syllabus/Deci%20Koestner%20Ryan%20meta%20IM%20psy%20bull%2099.pdf))
- **Tầng kế hoạch tuần rườm rà** — mục tiêu trung/xa ít tác dụng động lực một mình (Bandura).
- **Nhử việc dở để tạo căng thẳng** — hiệu ứng Zeigarnik _yếu/bị bác_ trong meta-analysis 2025; việc dở
  chỉ thôi ám ảnh khi _đã có kế hoạch cụ thể_ (Masicampo & Baumeister). → App chia nhỏ để hạ rào, không
  để nhắc nhở gây áp lực. ([Nature HSSC 2025](https://www.nature.com/articles/s41599-025-05000-w))
- **"Tiêu hao ý chí / decision fatigue"** như cơ chế nền — gần như bằng 0 sau replication 23-lab. App
  giảm số quyết định bằng _thói quen + AI gợi ý_, không "tiết kiệm ý chí".
  ([Ego depletion — Wikipedia](https://en.wikipedia.org/wiki/Ego_depletion))

### 6.3 Mô hình tổng (SDT + Fogg)

- **Self-Determination Theory** (Deci & Ryan): hỗ trợ **autonomy** (AI _đề xuất_, bạn _chọn_) và
  **competence** (calibrate thực tế + phản chiếu tiến bộ). App đơn người nên bỏ qua "relatedness".
- **Fogg Behavior Model** (B = MAP): hành vi cần Motivation × Ability × Prompt. Đòn rẻ & mạnh nhất là
  tăng **Ability** (chia nhỏ việc), không phải bơm động lực. ([behaviormodel.org](https://www.behaviormodel.org/))

## 7. Lộ trình đã hoàn thành

Tầng hành vi học được build theo thứ tự **lợi ích/ma sát giảm dần** (chính là áp 80/20 lên roadmap):

1. **Phase 1** — Học độ khó từ cảm xúc + AI tự chia nhỏ việc khó/trượt (bằng chứng mạnh nhất, 0 input mới).
2. **Phase 2** — Cue "khi nào/ở đâu" + streak ân hạn + goal-gradient + giọng văn tử tế.
3. **Phase 3** — Ưu tiên 80/20 + việc chính (MIT).
4. **Phase 4** — Personal OS: check-in + sức/ngày + ngày phục hồi.
5. **Phase 5** — Lý do trượt + phản chiếu danh tính + feedback thông tin.

Chi tiết kỹ thuật từng phần: xem [02 — Kỹ thuật](./02-technical.md).
