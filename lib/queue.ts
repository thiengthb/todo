import { daysBetween, toDateStr, todayStr } from './dates';
import type { FreeSlot } from './types';

/**
 * Logic thuần cho "Ấp ủ" (mục 17) — hàng đợi mục tiêu chưa cam kết.
 *
 * Mọi chỉ số (tuổi, độ-cũ, thứ tự gợi ý) tính ĐỘNG ở đây, KHÔNG lưu cột — giống
 * cách tính delay/streak/plan-progress. Không side-effect, dễ test, tái dùng cho
 * UI + notification + MCP.
 */

/** Tối thiểu để tính các chỉ số — khớp cả Prisma row lẫn DTO */
export interface GoalLite {
  title: string;
  note?: string | null;
  pinned: boolean;
  snoozedUntil: string | null;
  lastNudgedAt?: Date | null;
  createdAt: Date;
}

/** Số ngày kể từ lúc bắt giữ mục tiêu (tuổi động) */
export function goalAgeDays(goal: { createdAt: Date }, today: string = todayStr()): number {
  return Math.max(0, daysBetween(toDateStr(goal.createdAt), today));
}

/** Mốc snooze còn hiệu lực? (chưa tới ngày đã hẹn hoãn) */
export function isSnoozed(
  goal: { snoozedUntil: string | null },
  today: string = todayStr(),
): boolean {
  return goal.snoozedUntil != null && daysBetween(today, goal.snoozedUntil) > 0;
}

/**
 * "Lòng trắc ẩn với việc cũ" (mục 11.2): mục tiêu nằm im ≥30 ngày, chưa ghim, không snooze
 * → bật gợi ý nhẹ "còn muốn không? giữ / buông". Không phán xét, bỏ qua được.
 */
export function isStale(goal: GoalLite, today: string = todayStr()): boolean {
  if (goal.pinned || isSnoozed(goal, today)) return false;
  return goalAgeDays(goal, today) >= 30;
}

/**
 * Ước lượng "cỡ" mục tiêu từ văn bản — tín hiệu MỀM chỉ để khớp với khe rảnh khi xếp thứ tự
 * gợi ý. KHÔNG phải phán quyết task/plan (AI lo việc đó, mục 17). Heuristic: nhiều chữ / có
 * ghi chú → có vẻ lớn hơn.
 */
export function estimateGoalSize(goal: {
  title: string;
  note?: string | null;
}): 'small' | 'medium' | 'large' {
  const words = goal.title.trim().split(/\s+/).filter(Boolean).length;
  const hasNote = !!goal.note && goal.note.trim().length > 0;
  const weight = words + (hasNote ? 4 : 0);
  if (weight <= 3) return 'small';
  if (weight <= 6) return 'medium';
  return 'large';
}

/** Điểm khớp giữa cỡ mục tiêu và khe rảnh dài nhất + capacity (0..100) */
function fitScore(
  size: 'small' | 'medium' | 'large',
  longestSlotMin: number,
  capacity: number, // 0..100 (đã thay null bằng trung tính)
): number {
  const roomy = longestSlotMin >= 120 && capacity >= 55; // khe dài + sức tốt → hợp việc lớn
  const tight = longestSlotMin < 60 || capacity < 40; // khe ngắn / mệt → hợp việc nhỏ
  if (roomy) return size === 'large' ? 100 : size === 'medium' ? 70 : 40;
  if (tight) return size === 'small' ? 100 : size === 'medium' ? 60 : 20;
  return size === 'medium' ? 90 : 70; // khoảng giữa: ưu tiên việc vừa
}

/**
 * Xếp thứ tự mục tiêu để GỢI Ý (notification, thẻ Today, context suggest) — "khớp quỹ giờ &
 * năng lượng" (mục 17). Ưu tiên: đã ghim › chưa nudge gần đây › khớp khe rảnh/sức › mới hơn.
 * Loại mục tiêu đang snooze. Trả mảng mới (không đụng input).
 */
export function rankGoalsForNudge<T extends GoalLite>(
  goals: T[],
  freeSlots: FreeSlot[],
  capacityScore: number | null,
  today: string = todayStr(),
): T[] {
  const longestSlotMin = freeSlots.reduce((m, s) => Math.max(m, s.durationMin), 0);
  const capacity = capacityScore ?? 60; // null = trung tính nghiêng tốt
  const candidates = goals.filter((g) => !isSnoozed(g, today));

  const scored = candidates.map((g) => {
    let score = fitScore(estimateGoalSize(g), longestSlotMin, capacity);
    if (g.pinned) score += 1000;
    // tiết chế: vừa nudge trong 3 ngày → hạ mạnh để không lặp
    if (g.lastNudgedAt && daysBetween(toDateStr(g.lastNudgedAt), today) < 3) score -= 500;
    // mới hơn nhỉnh hơn để phá hoà (mục tiêu vừa bắt còn "nóng")
    score += Math.max(0, 30 - goalAgeDays(g, today)) * 0.1;
    return { g, score };
  });

  return scored.sort((a, b) => b.score - a.score).map((s) => s.g);
}
