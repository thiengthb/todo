"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isValidDateStr } from "@/lib/dates";
import { isValidHm } from "@/lib/notify/time";
import { hmToMinutes } from "@/lib/notify/time";
import type { ScheduleKind } from "@/lib/types";

const KINDS: ScheduleKind[] = ["hoc", "lam", "khac"];
const toKind = (k: string): ScheduleKind =>
  (KINDS as string[]).includes(k) ? (k as ScheduleKind) : "khac";

function revalidate() {
  // /schedule cho trang lịch, / cho dải lịch hôm nay
  revalidatePath("/schedule");
  revalidatePath("/");
}

export interface CommitmentInput {
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

export async function addCommitment(
  input: CommitmentInput,
): Promise<{ ok: boolean; error?: string }> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Cần tên lịch" };
  if (input.dayOfWeek < 0 || input.dayOfWeek > 6)
    return { ok: false, error: "Thứ không hợp lệ" };
  if (!validTimes(input.startTime, input.endTime))
    return { ok: false, error: "Giờ bắt đầu phải trước giờ kết thúc" };

  await prisma.commitment.create({
    data: {
      title,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      kind: toKind(input.kind),
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

  await prisma.commitment.update({
    where: { id },
    data: {
      title,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      kind: toKind(input.kind),
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
  if (!isValidDateStr(input.date)) return { ok: false, error: "Ngày không hợp lệ" };

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

export async function deleteScheduleEvent(id: string): Promise<void> {
  await prisma.scheduleEvent.delete({ where: { id } });
  revalidate();
}
