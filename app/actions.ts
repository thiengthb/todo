"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isValidDateStr, todayStr, tomorrowStr } from "@/lib/dates";
import type { Emotion } from "@/lib/types";

export async function addTask(title: string, date?: string): Promise<void> {
  const t = title.trim();
  if (!t) return;
  const d = date && isValidDateStr(date) ? date : todayStr();
  await prisma.task.create({ data: { title: t, date: d } });
  revalidatePath("/");
}

export async function toggleTask(id: string, done: boolean): Promise<void> {
  await prisma.task.update({
    where: { id },
    data: {
      done,
      completedAt: done ? new Date() : null,
      // bỏ done thì cảm xúc cũng không còn ý nghĩa
      ...(done ? {} : { emotion: null }),
    },
  });
  // "layout" để chip streak trên thanh menu (render ở root layout) cập nhật theo
  revalidatePath("/", "layout");
}

export async function setEmotion(id: string, emotion: Emotion): Promise<void> {
  const task = await prisma.task.findUnique({ where: { id } });
  // chỉ chấm cảm xúc cho task đã xong (spec: đánh giá việc chưa làm là vô nghĩa)
  if (!task?.done) return;
  await prisma.task.update({
    where: { id },
    // chạm lại cảm xúc đang chọn = bỏ chọn
    data: { emotion: task.emotion === emotion ? null : emotion },
  });
  revalidatePath("/");
}

export async function deleteTask(id: string): Promise<void> {
  await prisma.task.delete({ where: { id } });
  // xoá task done có thể làm đứt streak → revalidate cả layout cho chip trên menu
  revalidatePath("/", "layout");
}

/**
 * Thêm một đề xuất của AI vào ngày mai.
 * Với carry_over: tìm task dở gốc (cùng title) để giữ chuỗi carriedFrom —
 * mức trì hoãn tiếp tục tính từ ngày gốc, không reset.
 */
export async function addTomorrowTask(
  title: string,
  isCarryOver: boolean
): Promise<void> {
  const t = title.trim();
  if (!t) return;

  let carriedFrom: string | null = null;
  if (isCarryOver) {
    const origin = await prisma.task.findFirst({
      where: { title: t, done: false, date: { lte: todayStr() } },
      orderBy: { createdAt: "asc" },
    });
    if (origin) carriedFrom = origin.carriedFrom ?? origin.date;
  }

  await prisma.task.create({
    data: { title: t, date: tomorrowStr(), carriedFrom },
  });
  revalidatePath("/");
}

export async function saveNote(note: string): Promise<void> {
  const date = todayStr();
  const trimmed = note.trim();
  if (!trimmed) {
    // xoá note rỗng để DB sạch
    await prisma.dailyNote.deleteMany({ where: { date } });
  } else {
    await prisma.dailyNote.upsert({
      where: { date },
      create: { date, note: trimmed },
      update: { note: trimmed },
    });
  }
  revalidatePath("/");
}
