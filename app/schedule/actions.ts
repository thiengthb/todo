"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isValidDateStr } from "@/lib/dates";
import { isValidHm } from "@/lib/notify/time";
import { hmToMinutes } from "@/lib/notify/time";
import { saveScheduleSettings } from "@/lib/schedule-settings";
import type { ScheduleKind, ScheduleSettingsDTO } from "@/lib/types";

const KINDS: ScheduleKind[] = ["hoc", "lam", "khac"];
const toKind = (k: string): ScheduleKind =>
  (KINDS as string[]).includes(k) ? (k as ScheduleKind) : "khac";

function revalidate() {
  // /schedule cho trang lịch, / cho dải lịch hôm nay
  revalidatePath("/schedule");
  revalidatePath("/");
}

/** Field kỳ học dùng chung cho lịch cứng & khung mềm (mục 14) — tất cả tùy chọn */
interface SemesterInput {
  validFrom?: string | null;
  validUntil?: string | null;
  weekParity?: string | null;
}

export interface CommitmentInput extends SemesterInput {
  title: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  kind: string;
}

/** Kiểm tra chung cho khối có giờ: giờ hợp lệ + bắt đầu < kết thúc */
function validTimes(start: string, end: string): boolean {
  return (
    isValidHm(start) && isValidHm(end) && hmToMinutes(start) < hmToMinutes(end)
  );
}

/** Chuẩn hoá + kiểm tra field kỳ học. Trả data đã sạch hoặc lỗi. */
function normalizeSemester(i: SemesterInput):
  | {
      ok: true;
      data: {
        validFrom: string | null;
        validUntil: string | null;
        weekParity: string | null;
      };
    }
  | { ok: false; error: string } {
  const validFrom = i.validFrom?.trim() || null;
  const validUntil = i.validUntil?.trim() || null;
  if (validFrom && !isValidDateStr(validFrom))
    return { ok: false, error: "Ngày bắt đầu kỳ không hợp lệ" };
  if (validUntil && !isValidDateStr(validUntil))
    return { ok: false, error: "Ngày kết thúc kỳ không hợp lệ" };
  if (validFrom && validUntil && validFrom > validUntil)
    return { ok: false, error: "Ngày bắt đầu kỳ phải trước ngày kết thúc" };
  const weekParity =
    i.weekParity === "odd" || i.weekParity === "even" ? i.weekParity : null;
  return { ok: true, data: { validFrom, validUntil, weekParity } };
}

export async function addCommitment(
  input: CommitmentInput,
): Promise<{ ok: boolean; error?: string }> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Cần tên lịch" };
  if (input.dayOfWeek < 0 || input.dayOfWeek > 6)
    return { ok: false, error: "Thứ không hợp lệ" };
  if (!validTimes(input.startTime, input.endTime))
    return { ok: false, error: "Giờ bắt đầu phải trước giờ kết thúc" };
  const sem = normalizeSemester(input);
  if (!sem.ok) return sem;

  await prisma.commitment.create({
    data: {
      title,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      kind: toKind(input.kind),
      ...sem.data,
    },
  });
  revalidate();
  return { ok: true };
}

export async function updateCommitment(
  id: string,
  input: CommitmentInput,
): Promise<{ ok: boolean; error?: string }> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Cần tên lịch" };
  if (!validTimes(input.startTime, input.endTime))
    return { ok: false, error: "Giờ bắt đầu phải trước giờ kết thúc" };
  const sem = normalizeSemester(input);
  if (!sem.ok) return sem;

  await prisma.commitment.update({
    where: { id },
    data: {
      title,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      kind: toKind(input.kind),
      ...sem.data,
    },
  });
  revalidate();
  return { ok: true };
}

export async function setCommitmentActive(
  id: string,
  active: boolean,
): Promise<void> {
  await prisma.commitment.update({ where: { id }, data: { active } });
  revalidate();
}

export async function deleteCommitment(id: string): Promise<void> {
  await prisma.commitment.delete({ where: { id } });
  revalidate();
}

/* ───────── Soft block (khung giờ mềm, mục 14) ───────── */

export interface SoftBlockInput extends SemesterInput {
  title: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  kind: string;
}

export async function addSoftBlock(
  input: SoftBlockInput,
): Promise<{ ok: boolean; error?: string }> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Cần tên khung giờ" };
  if (input.dayOfWeek < 0 || input.dayOfWeek > 6)
    return { ok: false, error: "Thứ không hợp lệ" };
  if (!validTimes(input.startTime, input.endTime))
    return { ok: false, error: "Giờ bắt đầu phải trước giờ kết thúc" };
  const sem = normalizeSemester(input);
  if (!sem.ok) return sem;

  await prisma.softBlock.create({
    data: {
      title,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      kind: toKind(input.kind),
      ...sem.data,
    },
  });
  revalidate();
  return { ok: true };
}

export async function updateSoftBlock(
  id: string,
  input: SoftBlockInput,
): Promise<{ ok: boolean; error?: string }> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Cần tên khung giờ" };
  if (!validTimes(input.startTime, input.endTime))
    return { ok: false, error: "Giờ bắt đầu phải trước giờ kết thúc" };
  const sem = normalizeSemester(input);
  if (!sem.ok) return sem;

  await prisma.softBlock.update({
    where: { id },
    data: {
      title,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      kind: toKind(input.kind),
      ...sem.data,
    },
  });
  revalidate();
  return { ok: true };
}

export async function setSoftBlockActive(
  id: string,
  active: boolean,
): Promise<void> {
  await prisma.softBlock.update({ where: { id }, data: { active } });
  revalidate();
}

export async function deleteSoftBlock(id: string): Promise<void> {
  await prisma.softBlock.delete({ where: { id } });
  revalidate();
}

export interface ScheduleEventInput {
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  kind: string;
  cancels: boolean;
}

export async function addScheduleEvent(
  input: ScheduleEventInput,
): Promise<{ ok: boolean; error?: string }> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Cần tên sự kiện" };
  if (!isValidDateStr(input.date))
    return { ok: false, error: "Ngày không hợp lệ" };

  // có giờ thì phải hợp lệ; cả ngày (không giờ) hoặc cancels thì bỏ qua
  const hasTime = !!input.startTime && !!input.endTime;
  if (hasTime && !validTimes(input.startTime!, input.endTime!))
    return { ok: false, error: "Giờ bắt đầu phải trước giờ kết thúc" };

  await prisma.scheduleEvent.create({
    data: {
      title,
      date: input.date,
      startTime: hasTime ? input.startTime : null,
      endTime: hasTime ? input.endTime : null,
      kind: toKind(input.kind),
      cancels: !!input.cancels,
    },
  });
  revalidate();
  return { ok: true };
}

export async function updateScheduleEvent(
  id: string,
  input: ScheduleEventInput,
): Promise<{ ok: boolean; error?: string }> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Cần tên sự kiện" };
  if (!isValidDateStr(input.date))
    return { ok: false, error: "Ngày không hợp lệ" };

  const hasTime = !!input.startTime && !!input.endTime;
  if (hasTime && !validTimes(input.startTime!, input.endTime!))
    return { ok: false, error: "Giờ bắt đầu phải trước giờ kết thúc" };

  await prisma.scheduleEvent.update({
    where: { id },
    data: {
      title,
      date: input.date,
      startTime: hasTime ? input.startTime : null,
      endTime: hasTime ? input.endTime : null,
      kind: toKind(input.kind),
      cancels: !!input.cancels,
    },
  });
  revalidate();
  return { ok: true };
}

export async function deleteScheduleEvent(id: string): Promise<void> {
  await prisma.scheduleEvent.delete({ where: { id } });
  revalidate();
}

/** Lưu cấu hình giờ thức / buffer / ngưỡng khe (mục 14) */
export async function updateScheduleSettings(
  input: ScheduleSettingsDTO,
): Promise<{ ok: boolean; error?: string }> {
  if (!isValidHm(input.wakeTime) || !isValidHm(input.sleepTime))
    return { ok: false, error: "Giờ không hợp lệ" };
  if (hmToMinutes(input.wakeTime) >= hmToMinutes(input.sleepTime))
    return { ok: false, error: "Giờ thức phải trước giờ ngủ" };
  if (input.bufferMin < 0 || input.bufferMin > 120)
    return { ok: false, error: "Buffer phải trong khoảng 0–120 phút" };
  if (input.minSlotMin < 0 || input.minSlotMin > 240)
    return { ok: false, error: "Ngưỡng khe không hợp lệ" };
  if (input.termAnchorMonday && !isValidDateStr(input.termAnchorMonday))
    return { ok: false, error: "Mốc tuần không hợp lệ" };

  await saveScheduleSettings(input);
  revalidate();
  return { ok: true };
}
