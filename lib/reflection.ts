/**
 * "Identity reflection" + informational feedback (section 11).
 *
 * Evidence: extrinsic rewards (points/badges) erode intrinsic motivation, BUT INFORMATIONAL feedback
 * is safe and even reinforces a sense of competence. "Identity-as-evidence"
 * (Atomic Habits) works when it REFLECTS a real pattern, NOT when it forces the user to claim a role.
 * → Returns a short sentence inferred from real data, or null if there isn't enough signal.
 */
export function buildReflection(input: {
  /** number of days with a done task in the last 7 days (including today) */
  activeDays7: number;
  /** number of "hard" tasks done in the last 7 days */
  hardDone7: number;
  /** total tasks done in the last 7 days */
  done7: number;
}): string | null {
  const { activeDays7, hardDone7, done7 } = input;
  if (activeDays7 >= 5) {
    return `${activeDays7}/7 ngày gần đây bạn đều có việc hoàn thành — đang thành một thói quen.`;
  }
  if (hardDone7 >= 3) {
    return `Tuần qua bạn đã xong ${hardDone7} việc mình thấy "khó" — không nhỏ chút nào.`;
  }
  if (done7 >= 5) {
    return `Tuần qua bạn hoàn thành ${done7} việc. Cứ đều đặn như vậy là đủ.`;
  }
  return null;
}
