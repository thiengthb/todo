/**
 * Tốc độ thật (velocity) tính ĐỘNG — khớp đúng cách `/api/suggest` tính `weeklyAvg.avgDonePerDay`
 * để con số hiện trên trang Hôm nay TRÙNG với con số AI dùng (minh bạch, không lệch).
 *
 * Chỉ tính trên những ngày THỰC SỰ có task (daysWithData) — bỏ ngày trống để không kéo tụt
 * trung bình. Nhận task lá (đã lọc container ở nơi gọi), mỗi task có `date` + `done`.
 */
export interface Velocity {
  /** trung bình số việc xong mỗi ngày-có-dữ-liệu (làm tròn 1 chữ số thập phân) */
  avgDonePerDay: number;
  /** số ngày có ít nhất 1 task trong cửa sổ — độ tin cậy của con số */
  daysWithData: number;
}

export function computeVelocity(
  tasks: { date: string; done: boolean }[],
): Velocity | null {
  const byDate = new Map<string, number>();
  let totalDone = 0;
  for (const t of tasks) {
    byDate.set(t.date, (byDate.get(t.date) ?? 0) + (t.done ? 1 : 0));
    if (t.done) totalDone += 1;
  }
  const daysWithData = byDate.size;
  if (daysWithData === 0) return null;
  return {
    avgDonePerDay: Math.round((totalDone / daysWithData) * 10) / 10,
    daysWithData,
  };
}
