import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { suggestTomorrow, type SuggestContext } from "@/lib/ai";
import { daysBetween, delayDays, toDateStr, todayStr, tomorrowStr } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  try {
    const today = todayStr();

    // 7 ngày gần nhất (không tính hôm nay) để tính tốc độ thực tế
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = toDateStr(weekAgo);

    const [todayTasks, undoneTasks, recentTasks, note] = await Promise.all([
      prisma.task.findMany({ where: { date: today } }),
      // việc còn dở: mọi task chưa done có date đến hôm nay
      prisma.task.findMany({
        where: { done: false, date: { lte: today } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.task.findMany({
        where: { date: { gte: weekAgoStr, lt: today } },
      }),
      prisma.dailyNote.findUnique({ where: { date: today } }),
    ]);

    // Trung bình ~7 ngày: chỉ tính những ngày thực sự có task
    const byDate = new Map<string, { done: number; total: number }>();
    for (const t of recentTasks) {
      const d = byDate.get(t.date) ?? { done: 0, total: 0 };
      d.total += 1;
      if (t.done) d.done += 1;
      byDate.set(t.date, d);
    }
    const daysWithData = byDate.size;
    const weeklyAvg =
      daysWithData > 0
        ? {
            avgDonePerDay:
              Math.round(
                ([...byDate.values()].reduce((s, d) => s + d.done, 0) / daysWithData) * 10
              ) / 10,
            avgPercent: Math.round(
              ([...byDate.values()].reduce(
                (s, d) => s + (d.total ? d.done / d.total : 0),
                0
              ) /
                daysWithData) *
                100
            ),
            daysWithData,
          }
        : null;

    const doneToday = todayTasks
      .filter((t) => t.done)
      .map((t) => ({ title: t.title, emotion: t.emotion }));

    const ctx: SuggestContext = {
      today,
      tomorrow: tomorrowStr(),
      doneToday,
      undone: undoneTasks.map((t) => ({
        title: t.title,
        delayDays: Math.max(delayDays(t), daysBetween(t.date, today)),
      })),
      todayRate: { done: doneToday.length, total: todayTasks.length },
      weeklyAvg,
      note: note?.note ?? null,
    };

    const result = await suggestTomorrow(ctx);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
