import { addDays } from '@/lib/dates';
import type { HabitDTO, HabitStatus } from '@/lib/types';

/** 0=CN..6=T7 của một chuỗi ngày "YYYY-MM-DD" (giờ địa phương) */
function dowOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getDay();
}

/** Thói quen có "đến hạn" vào ngày này không (daysOfWeek null = hằng ngày) */
export function habitDueOn(habit: Pick<HabitDTO, 'daysOfWeek'>, dateStr: string): boolean {
  if (!habit.daysOfWeek) return true;
  const days = habit.daysOfWeek
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n));
  return days.includes(dowOf(dateStr));
}

/**
 * Trạng thái động của một thói quen (mục 11) — KHÔNG lưu cứng, suy từ các ngày đã tick.
 * streak = số NGÀY-ĐẾN-HẠN liên tiếp (lùi từ hôm nay) đã tick; hôm nay chưa tick KHÔNG
 * làm đứt (ân hạn nhẹ — chỉ là feedback thông tin, không phải điểm số).
 */
export function computeHabitStatus(
  habit: Pick<HabitDTO, 'daysOfWeek'>,
  checkedDates: string[],
  today: string,
): HabitStatus {
  const checked = new Set(checkedDates);
  const dueToday = habitDueOn(habit, today);
  const doneToday = checked.has(today);

  let streak = 0;
  // duyệt tối đa ~1 năm ngày đến hạn, lùi dần
  for (let i = 0; i < 366; i++) {
    const day = addDays(today, -i);
    if (!habitDueOn(habit, day)) continue;
    if (checked.has(day)) {
      streak += 1;
    } else if (day === today) {
      continue; // hôm nay chưa tick — chưa tính, nhưng không đứt chuỗi
    } else {
      break;
    }
  }
  return { dueToday, doneToday, streak };
}
