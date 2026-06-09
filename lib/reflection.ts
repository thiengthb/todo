/**
 * "Phản chiếu danh tính" + feedback thông tin (mục 11).
 *
 * Bằng chứng: phần thưởng ngoại lai (điểm/badge) bào mòn động lực nội tại, NHƯNG feedback
 * mang tính THÔNG TIN thì an toàn và còn củng cố cảm giác năng lực. "Identity-as-evidence"
 * (Atomic Habits) hiệu quả khi PHẢN CHIẾU pattern thật, KHÔNG bắt người dùng tự nhận vai.
 * → Trả về một câu ngắn suy từ dữ liệu thật, hoặc null nếu chưa đủ tín hiệu.
 */
export function buildReflection(input: {
  /** số ngày có việc xong trong 7 ngày gần đây (kể cả hôm nay) */
  activeDays7: number;
  /** số việc "hard" đã xong trong 7 ngày */
  hardDone7: number;
  /** tổng việc đã xong trong 7 ngày */
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
