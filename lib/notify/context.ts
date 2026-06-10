import { prisma } from "@/lib/db";
import { computeStreaks } from "@/lib/streak";
import { computePlanProgress } from "@/lib/plan";
import { todayStr } from "@/lib/dates";
import { blocksForDate, freeMinutes } from "@/lib/schedule";
import type { NotificationFacts } from "@/lib/ai";
import type {
  CommitmentDTO,
  NotificationKind,
  ScheduleEventDTO,
  ScheduleKind,
} from "@/lib/types";

// task "container" (có ≥1 con) là nhóm, không tính vào stats/streak (mục 11)
const NOT_CONTAINER = { subtasks: { none: {} } };

const IMPACT_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

/**
 * Lắp DỮ KIỆN THẬT cho thông báo (mục 13). Đây là phần "code" — mọi con số/tên việc
 * truy ngược được về DB; AI chỉ viết giọng văn quanh đây, không tự bịa.
 */
export async function buildNotificationFacts(
  kind: NotificationKind,
): Promise<NotificationFacts> {
  const today = todayStr();

  const [
    todayLeaves,
    undoneLeaves,
    activeDayRows,
    plans,
    commitmentRows,
    eventRows,
  ] = await Promise.all([
    // việc lá hôm nay (bỏ container)
    prisma.task.findMany({ where: { date: today, ...NOT_CONTAINER } }),
    // việc còn dở đến hôm nay (bỏ container) — để cú hích bám vào
    prisma.task.findMany({
      where: { done: false, date: { lte: today }, ...NOT_CONTAINER },
      orderBy: { createdAt: "asc" },
    }),
    // ngày có việc done → tính streak động
    prisma.task.findMany({
      where: { done: true },
      select: { date: true },
      distinct: ["date"],
    }),
    prisma.plan.findMany({
      where: { status: "active" },
      include: { milestones: { orderBy: { order: "asc" } } },
    }),
    prisma.commitment.findMany({ where: { active: true } }),
    prisma.scheduleEvent.findMany({ where: { date: today } }),
  ]);

  // lịch cứng hôm nay → quỹ giờ rảnh + tóm tắt cho giọng văn (mục 14)
  const commitments: CommitmentDTO[] = commitmentRows.map((c) => ({
    id: c.id,
    title: c.title,
    dayOfWeek: c.dayOfWeek,
    startTime: c.startTime,
    endTime: c.endTime,
    kind: c.kind as ScheduleKind,
    active: c.active,
  }));
  const scheduleEvents: ScheduleEventDTO[] = eventRows.map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    startTime: e.startTime,
    endTime: e.endTime,
    kind: e.kind as ScheduleKind,
    cancels: e.cancels,
  }));
  const todayBlocks = blocksForDate(today, commitments, scheduleEvents);
  const todaySchedule = todayBlocks.map((b) =>
    b.startTime && b.endTime
      ? `${b.startTime}–${b.endTime} ${b.title}`
      : `Cả ngày ${b.title}`,
  );
  const freeMinutesToday = freeMinutes(today, commitments, scheduleEvents);

  const streak = computeStreaks(
    activeDayRows.map((r) => r.date),
    today,
  );

  const doneToday = todayLeaves.filter((t) => t.done);

  // "việc chính" (MIT): việc CHƯA xong điểm tác động cao nhất — ưu tiên việc hôm nay,
  // nếu hôm nay không có thì lấy trong các việc dở chung.
  const undoneToday = todayLeaves.filter((t) => !t.done);
  const mitPool = undoneToday.length > 0 ? undoneToday : undoneLeaves;
  let mit = mitPool[0] ?? null;
  for (const t of mitPool) {
    const score = (t.impact ? IMPACT_RANK[t.impact] : 0) + (t.planId ? 1 : 0);
    const bestScore = mit
      ? (mit.impact ? IMPACT_RANK[mit.impact] : 0) + (mit.planId ? 1 : 0)
      : -1;
    if (score > bestScore) mit = t;
  }

  // kế hoạch đang chậm (behindDays ≥ 1) — tính động
  const behindPlans = plans
    .filter((p) => computePlanProgress(p, p.milestones, today).behindDays >= 1)
    .map((p) => p.title);

  // capacity hôm nay nếu có check-in
  const checkin = await prisma.dayCheckin.findUnique({ where: { date: today } });
  let capacityScore: number | null = null;
  if (checkin) {
    const { computeCapacity } = await import("@/lib/capacity");
    capacityScore = computeCapacity(checkin);
  }

  return {
    kind,
    streakCurrent: streak.current,
    streakAtRisk: streak.atRisk,
    doneCount: doneToday.length,
    totalCount: todayLeaves.length,
    undoneCount: undoneLeaves.length,
    mitTitle: mit?.title ?? null,
    sampleUndone: undoneLeaves.slice(0, 3).map((t) => t.title),
    behindPlans,
    capacityScore,
    todaySchedule,
    freeMinutesToday,
  };
}
