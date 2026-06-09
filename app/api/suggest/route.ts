import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  suggestTomorrow,
  type ActivePlanContext,
  type SuggestContext,
} from "@/lib/ai";
import {
  daysBetween,
  delayDays,
  toDateStr,
  todayStr,
  tomorrowStr,
} from "@/lib/dates";
import { computePlanProgress } from "@/lib/plan";
import { computeDifficultyHints } from "@/lib/difficulty";
import type { PlanAlert } from "@/lib/types";

export const dynamic = "force-dynamic";

// task "container" (có ≥1 con) là nhóm, không tính vào stats/tốc độ thật (mục 11)
const NOT_CONTAINER = { subtasks: { none: {} } };

export async function POST(): Promise<NextResponse> {
  try {
    const today = todayStr();

    // 7 ngày gần nhất (không tính hôm nay) để tính tốc độ thực tế
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = toDateStr(weekAgo);

    // 14 ngày để lắp "reference class" độ khó (mục 11)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const twoWeeksAgoStr = toDateStr(twoWeeksAgo);

    const [todayTasks, undoneTasks, recentTasks, ratedTasks, note, plans] =
      await Promise.all([
        prisma.task.findMany({ where: { date: today, ...NOT_CONTAINER } }),
        // việc còn dở: mọi task chưa done có date đến hôm nay (bỏ container)
        prisma.task.findMany({
          where: { done: false, date: { lte: today }, ...NOT_CONTAINER },
          orderBy: { createdAt: "asc" },
        }),
        prisma.task.findMany({
          where: { date: { gte: weekAgoStr, lt: today }, ...NOT_CONTAINER },
        }),
        // việc đã chấm cảm xúc ~14 ngày → suy độ khó
        prisma.task.findMany({
          where: {
            date: { gte: twoWeeksAgoStr, lte: today },
            emotion: { not: null },
            ...NOT_CONTAINER,
          },
          select: { title: true, emotion: true },
        }),
        prisma.dailyNote.findUnique({ where: { date: today } }),
        prisma.plan.findMany({
          where: { status: "active" },
          include: { milestones: { orderBy: { order: "asc" } } },
        }),
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
                ([...byDate.values()].reduce((s, d) => s + d.done, 0) /
                  daysWithData) *
                  10,
              ) / 10,
            avgPercent: Math.round(
              ([...byDate.values()].reduce(
                (s, d) => s + (d.total ? d.done / d.total : 0),
                0,
              ) /
                daysWithData) *
                100,
            ),
            daysWithData,
          }
        : null;

    const doneToday = todayTasks
      .filter((t) => t.done)
      .map((t) => ({ title: t.title, emotion: t.emotion }));

    // Kế hoạch đang chạy + tiến độ động → ngữ cảnh cho model rót việc kế tiếp
    const progressById = new Map(
      plans.map((p) => [p.id, computePlanProgress(p, p.milestones, today)]),
    );
    const activePlans: ActivePlanContext[] = plans.map((p) => {
      const prog = progressById.get(p.id)!;
      const next = p.milestones.find((m) => !m.done);
      return {
        id: p.id,
        title: p.title,
        goal: p.goal,
        currentMilestone: next ? { id: next.id, title: next.title } : null,
        progressPct: prog.progressPct,
        behindDays: prog.behindDays,
        totalMilestones: prog.total,
        doneMilestones: prog.done,
      };
    });

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
      activePlans,
      // reference class độ khó (mục 11): cap ~40 mục gần nhất cho gọn prompt
      recentDone: ratedTasks
        .slice(-40)
        .map((t) => ({ title: t.title, emotion: t.emotion })),
      difficultyHints: computeDifficultyHints(ratedTasks),
    };

    const result = await suggestTomorrow(ctx);

    // Chỉ giữ plan_task có planId hợp lệ (tránh model bịa id)
    const validPlanIds = new Set(plans.map((p) => p.id));
    result.plan_tasks = result.plan_tasks.filter((t) =>
      validPlanIds.has(t.planId),
    );

    // Cảnh báo chậm: tính ĐỘNG ở server, không để model bịa số (mục 10.4)
    result.plan_alerts = plans
      .map((p): PlanAlert | null => {
        const prog = progressById.get(p.id)!;
        if (prog.behindDays < 1) return null;
        return {
          planId: p.id,
          planTitle: p.title,
          behindDays: prog.behindDays,
          options: [
            `Giãn deadline thêm ~${prog.behindDays} ngày`,
            "Bỏ bớt một cột mốc chưa quan trọng",
            "Giữ nguyên và tăng tốc",
          ],
        };
      })
      .filter((a): a is PlanAlert => a !== null);

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
