/**
 * "Capacity" (sức/ngày) tính ĐỘNG (mục 11) — không lưu cứng.
 *
 * Lưu ý bằng chứng: planning theo năng lượng là hợp lý nhưng bằng chứng MỀM, nên đây chỉ
 * là tín hiệu phụ giúp AI giảm/giữ tải, KHÔNG phải con số tuyệt đối. Mọi field check-in đều
 * optional — thiếu thì trả null và AI chỉ dựa vào tốc độ thật như cũ (degrade mượt).
 */
export interface DayCheckinLite {
  energy: number | null;
  mood: number | null;
  stress: number | null;
  sleepHours: number | null;
}

/**
 * Quy các tín hiệu (thang 1..5, giấc ngủ theo giờ) về 0..100. Trả null nếu check-in trống.
 * Quanh 50 = bình thường; energy/mood kéo lên, stress kéo xuống, ngủ < 6h trừ điểm.
 */
export function computeCapacity(c: DayCheckinLite | null): number | null {
  if (!c) return null;
  const hasAny = c.energy != null || c.mood != null || c.stress != null || c.sleepHours != null;
  if (!hasAny) return null;

  let score = 50;
  if (c.energy != null) score += (c.energy - 3) * 12; // ±24
  if (c.mood != null) score += (c.mood - 3) * 6; // ±12
  if (c.stress != null) score -= (c.stress - 3) * 10; // ∓20
  if (c.sleepHours != null) {
    if (c.sleepHours < 6) score -= (6 - c.sleepHours) * 8;
    else if (c.sleepHours >= 7) score += 6;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}
