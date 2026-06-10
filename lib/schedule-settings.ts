import { prisma } from "@/lib/db";
import type { ScheduleSettingsDTO } from "@/lib/types";

const SINGLETON_ID = "singleton";

/** Mặc định khi chưa có hàng nào (khớp default schema + hằng số 07–23h cũ) */
export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettingsDTO = {
  wakeTime: "07:00",
  sleepTime: "23:00",
  bufferMin: 15,
  minSlotMin: 30,
  termAnchorMonday: null,
};

/** Đọc cấu hình lịch (1 hàng singleton). Chưa có → trả mặc định. */
export async function getScheduleSettings(): Promise<ScheduleSettingsDTO> {
  const row = await prisma.scheduleSettings.findUnique({
    where: { id: SINGLETON_ID },
  });
  if (!row) return { ...DEFAULT_SCHEDULE_SETTINGS };
  return {
    wakeTime: row.wakeTime,
    sleepTime: row.sleepTime,
    bufferMin: row.bufferMin,
    minSlotMin: row.minSlotMin,
    termAnchorMonday: row.termAnchorMonday,
  };
}

/** Lưu cấu hình lịch (upsert hàng singleton). */
export async function saveScheduleSettings(
  data: ScheduleSettingsDTO,
): Promise<void> {
  const payload = {
    wakeTime: data.wakeTime,
    sleepTime: data.sleepTime,
    bufferMin: data.bufferMin,
    minSlotMin: data.minSlotMin,
    termAnchorMonday: data.termAnchorMonday?.trim() || null,
  };
  await prisma.scheduleSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...payload },
    update: payload,
  });
}
