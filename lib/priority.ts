import type { TaskDTO } from "./types";

const IMPACT_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

/**
 * Điểm 80/20 (mục 11): ưu tiên việc tác động cao, thuộc kế hoạch, đã trì hoãn.
 * Dùng để chọn "việc chính" (MIT) trong ngày — KHÔNG sắp xếp lại danh sách
 * (giữ thứ tự nhập cho quen mắt), chỉ làm nổi bật 1 việc.
 */
function valueScore(t: TaskDTO): number {
  const impact = t.impact ? IMPACT_RANK[t.impact] : 0;
  return impact * 10 + (t.planTitle ? 3 : 0) + Math.min(t.delay, 5);
}

/**
 * Chọn id của "việc chính" hôm nay: việc CHƯA xong có điểm 80/20 cao nhất.
 * Chỉ trả về khi có ≥2 việc chưa xong và việc top thực sự có tín hiệu (điểm > 0),
 * để badge "việc chính" có ý nghĩa.
 */
export function pickMitId(leaves: TaskDTO[]): string | null {
  const undone = leaves.filter((t) => !t.done);
  if (undone.length < 2) return null;
  let best = undone[0];
  for (const t of undone) {
    if (valueScore(t) > valueScore(best)) best = t;
  }
  return valueScore(best) > 0 ? best.id : null;
}
