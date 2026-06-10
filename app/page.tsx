import { prisma } from "@/lib/db";
import {
  addDays,
  dayLabel,
  delayDays,
  formatDateVN,
  isValidDateStr,
  todayStr,
} from "@/lib/dates";
import { DayNav } from "@/components/day-nav";
import { pickMitId } from "@/lib/priority";
import { buildReflection } from "@/lib/reflection";
import { computeStreaks } from "@/lib/streak";
import { computeVelocity } from "@/lib/velocity";
import { computeDifficultyHints } from "@/lib/difficulty";
import { computePlanProgress } from "@/lib/plan";
import { habitDueOn } from "@/lib/habits";
import type {
  CommitmentDTO,
  Emotion,
  Priority,
  ScheduleEventDTO,
  ScheduleKind,
  SoftBlockDTO,
  TaskDTO,
} from "@/lib/types";
import { AddTask } from "@/components/today/add-task";
import { CheckinBox } from "@/components/today/checkin-box";
import { NoteBox } from "@/components/today/note-box";
import { StatsCards } from "@/components/today/stats-cards";
import { SuggestSheet } from "@/components/today/suggest-sheet";
import { TaskItem } from "@/components/today/task-item";
import { ScheduleStrip } from "@/components/today/schedule-strip";
import { StreakBanner } from "@/components/today/streak-banner";
import { PlanMomentum } from "@/components/today/plan-momentum";
import { HabitStrip } from "@/components/today/habit-strip";
import { FocusBar } from "@/components/today/focus-bar";
import { DayTimeline } from "@/components/today/day-timeline";
import { EmptyState } from "@/components/empty-state";
import { ListTodo } from "lucide-react";
import {
  blocksForDate,
  computeFreeSlots,
  softBlocksForDate,
} from "@/lib/schedule";
import { getScheduleSettings } from "@/lib/schedule-settings";
import { toHm } from "@/lib/notify/time";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ date?: string; view?: string }>;
}

export default async function DayPage({ searchParams }: PageProps) {
  const { date: raw, view: rawView } = await searchParams;
  const today = todayStr();
  const date = raw && isValidDateStr(raw) ? raw : today;
  // chuỗi ISO so sánh từ điển = so sánh thời gian
  const isToday = date === today;
  const isPast = date < today;

  const [
    tasks,
    dailyNote,
    checkin,
    recentDone7,
    commitmentRows,
    eventRows,
    softBlockRows,
    scheduleSettings,
    activeDayRows,
    weekTaskRows,
    ratedRows,
    activePlanRows,
    habitRows,
    habitCheckRows,
  ] = await Promise.all([
    // chỉ lấy task gốc của ngày; task con (đã chia nhỏ) nằm trong subtasks (mục 11)
    prisma.task.findMany({
      where: { date, parentId: null },
      orderBy: { createdAt: "asc" },
      include: {
        plan: { select: { title: true } },
        subtasks: {
          orderBy: { createdAt: "asc" },
          include: { plan: { select: { title: true } } },
        },
      },
    }),
    prisma.dailyNote.findUnique({ where: { date } }),
    // check-in chỉ cần cho hôm nay (Personal OS, mục 11)
    isToday
      ? prisma.dayCheckin.findUnique({ where: { date } })
      : Promise.resolve(null),
    // việc xong 7 ngày gần đây (bỏ container) để phản chiếu danh tính (mục 11)
    isToday
      ? prisma.task.findMany({
          where: {
            done: true,
            date: { gte: addDays(today, -6), lte: today },
            subtasks: { none: {} },
          },
          select: { date: true, emotion: true },
        })
      : Promise.resolve([]),
    // lịch trình (mục 14): commitment đang bật + event của ngày đang xem + khung mềm + cấu hình
    prisma.commitment.findMany({ where: { active: true } }),
    prisma.scheduleEvent.findMany({ where: { date } }),
    prisma.softBlock.findMany({ where: { active: true } }),
    getScheduleSettings(),
    // các tín hiệu "thông minh" — chỉ cần cho hôm nay (mục 11/12)
    // ngày "giữ lửa" → tính streak (banner nhắc khi sắp đứt)
    isToday
      ? prisma.task.findMany({
          where: { done: true },
          select: { date: true },
          distinct: ["date"],
        })
      : Promise.resolve([]),
    // task lá ~7 ngày trước → tốc độ thật (khớp weeklyAvg của /api/suggest)
    isToday
      ? prisma.task.findMany({
          where: {
            date: { gte: addDays(today, -7), lt: today },
            subtasks: { none: {} },
          },
          select: { date: true, done: true },
        })
      : Promise.resolve([]),
    // task lá đã chấm cảm xúc ~14 ngày → suy chủ đề "hay mệt" (difficulty hints)
    isToday
      ? prisma.task.findMany({
          where: {
            date: { gte: addDays(today, -13), lte: today },
            emotion: { not: null },
            subtasks: { none: {} },
          },
          select: { title: true, emotion: true },
        })
      : Promise.resolve([]),
    // kế hoạch đang chạy → momentum card + tiến độ động
    isToday
      ? prisma.plan.findMany({
          where: { status: "active" },
          include: { milestones: { orderBy: { order: "asc" } } },
        })
      : Promise.resolve([]),
    // thói quen đang bật + lần tick hôm nay (mục 11) — chỉ cho hôm nay
    isToday
      ? prisma.habit.findMany({ where: { active: true } })
      : Promise.resolve([]),
    isToday
      ? prisma.habitCheck.findMany({
          where: { date },
          select: { habitId: true },
        })
      : Promise.resolve([]),
  ]);

  // dải lịch cứng của ngày đang xem (read-only) + quỹ giờ rảnh động
  const commitments: CommitmentDTO[] = commitmentRows.map((c) => ({
    id: c.id,
    title: c.title,
    dayOfWeek: c.dayOfWeek,
    startTime: c.startTime,
    endTime: c.endTime,
    kind: c.kind as ScheduleKind,
    active: c.active,
    validFrom: c.validFrom,
    validUntil: c.validUntil,
    weekParity: c.weekParity,
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
  const softBlocks: SoftBlockDTO[] = softBlockRows.map((s) => ({
    id: s.id,
    title: s.title,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    kind: (["hoc", "lam", "khac"].includes(s.kind)
      ? s.kind
      : "khac") as ScheduleKind,
    active: s.active,
    validFrom: s.validFrom,
    validUntil: s.validUntil,
    weekParity: s.weekParity,
  }));
  const anchor = scheduleSettings.termAnchorMonday;
  // khe trống + quỹ giờ rảnh động (mục 14) cho ngày đang xem
  const capacity = computeFreeSlots(
    date,
    commitments,
    scheduleEvents,
    scheduleSettings,
  );
  const scheduleFree = capacity.capacityMin;
  // khối hiển thị: lịch cứng + khung mềm (cho dải chip + timeline)
  const scheduleBlocks = [
    ...blocksForDate(date, commitments, scheduleEvents, anchor),
    ...softBlocksForDate(date, softBlocks, scheduleEvents, anchor),
  ].sort((a, b) => {
    if (a.startTime === b.startTime) return 0;
    if (a.startTime === null) return -1;
    if (b.startTime === null) return 1;
    return a.startTime.localeCompare(b.startTime);
  });

  const dtos: TaskDTO[] = tasks.map((t) => {
    const subtasks: TaskDTO[] = t.subtasks.map((c) => ({
      id: c.id,
      title: c.title,
      done: c.done,
      emotion: c.emotion as Emotion | null,
      delay: c.done || isPast ? 0 : delayDays(c),
      planTitle: c.plan?.title ?? null,
      cue: c.cue,
      impact: c.impact as Priority | null,
      slipReason: c.slipReason,
      estimatedMinutes: c.estimatedMinutes,
      deepWork: c.deepWork,
      actualBucket: c.actualBucket,
      scheduledFor: c.scheduledFor ? toHm(c.scheduledFor) : null,
    }));
    const isContainer = subtasks.length > 0;
    return {
      id: t.id,
      title: t.title,
      // task cha "container": done = mọi bước con done; không chấm cảm xúc / không badge trì hoãn
      done: isContainer ? subtasks.every((s) => s.done) : t.done,
      emotion: isContainer ? null : (t.emotion as Emotion | null),
      delay: isContainer || t.done || isPast ? 0 : delayDays(t),
      planTitle: t.plan?.title ?? null,
      subtasks: isContainer ? subtasks : undefined,
      cue: t.cue,
      impact: t.impact as Priority | null,
      slipReason: t.slipReason,
      estimatedMinutes: t.estimatedMinutes,
      deepWork: t.deepWork,
      actualBucket: t.actualBucket,
      scheduledFor: t.scheduledFor ? toHm(t.scheduledFor) : null,
    };
  });

  // stats đếm theo việc thật (bước con + việc đơn), bỏ qua container — mục 11
  const leaves = dtos.flatMap((t) => t.subtasks ?? [t]);
  const doneCount = leaves.filter((t) => t.done).length;
  // "việc chính" hôm nay (MIT, 80/20) — chỉ làm nổi bật, không đổi thứ tự
  const mitId = isToday ? pickMitId(leaves) : null;

  // phản chiếu danh tính + feedback thông tin (mục 11) — suy từ 7 ngày gần đây
  const reflection = isToday
    ? buildReflection({
        activeDays7: new Set(recentDone7.map((t) => t.date)).size,
        hardDone7: recentDone7.filter((t) => t.emotion === "hard").length,
        done7: recentDone7.length,
      })
    : null;

  // Tín hiệu "thông minh" khác (chỉ hôm nay) — mỗi cái TỰ ẩn khi thiếu dữ liệu (mục 11/12)
  const streak = isToday
    ? computeStreaks(
        activeDayRows.map((r) => r.date),
        today,
      )
    : null;
  const velocity = isToday ? computeVelocity(weekTaskRows) : null;
  const hardTopics = isToday
    ? computeDifficultyHints(ratedRows).hardTopics
    : [];
  const planMomentum = isToday
    ? activePlanRows.map((p) => {
        const prog = computePlanProgress(p, p.milestones, today);
        return {
          id: p.id,
          title: p.title,
          currentMilestone: prog.currentMilestone,
          progressPct: prog.progressPct,
          behindDays: prog.behindDays,
        };
      })
    : [];
  // banner nhắc giữ lửa: chỉ khi chuỗi sắp đứt VÀ hôm nay chưa xong việc nào
  const showStreakBanner = isToday && !!streak?.atRisk && doneCount === 0;

  // thói quen đến hạn hôm nay (mục 11) — 1 chạm, không điểm
  const checkedHabitIds = new Set(habitCheckRows.map((r) => r.habitId));
  const todayHabits = isToday
    ? habitRows
        .filter((h) => habitDueOn(h, today))
        .map((h) => ({
          id: h.id,
          title: h.title,
          doneToday: checkedHabitIds.has(h.id),
        }))
    : [];

  // ── Timeline (mục 14): tách việc đã xếp giờ vs chưa; chọn chế độ xem ──
  const timelineTasks = dtos.filter((t) => !t.subtasks && t.scheduledFor);
  const unscheduledTasks = dtos.filter((t) => t.subtasks || !t.scheduledFor);
  // tổng ước lượng việc CHƯA xong (cho cảnh báo quá tải)
  const plannedMin = leaves
    .filter((t) => !t.done && t.estimatedMinutes)
    .reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);
  // mặc định: có dữ liệu lịch/việc-đã-xếp → timeline; quá khứ → ép list
  const hasTimelineData = scheduleBlocks.length > 0 || timelineTasks.length > 0;
  const view: "list" | "timeline" = isPast
    ? "list"
    : rawView === "list" || rawView === "timeline"
      ? rawView
      : hasTimelineData
        ? "timeline"
        : "list";

  return (
    <div className="py-8">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground capitalize">
            {formatDateVN(date)}
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight capitalize sm:text-2xl">
            {dayLabel(date)}
          </h1>
          {/* phản chiếu danh tính — feedback thông tin, không điểm số (mục 11) */}
          {reflection && (
            <p className="mt-2 text-xs text-muted-foreground">{reflection}</p>
          )}
        </div>
        <DayNav date={date} today={today} />
      </header>

      {/* Nhắc giữ lửa khi chuỗi sắp đứt (mục 11) — full-width trên dashboard */}
      {showStreakBanner && streak && <StreakBanner current={streak.current} />}

      {/* Dashboard 2 cột: việc (trái) · thống kê/check-in/đề xuất (phải) */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-label="Danh sách việc" className="min-w-0">
          {/* thanh tiêu điểm: quỹ giờ + toggle Danh sách/Dòng giờ (gộp 2 dải cũ) */}
          {!isPast && (
            <FocusBar
              date={date}
              view={view}
              freeMin={scheduleFree}
              slotCount={capacity.slots.length}
              plannedMin={plannedMin}
            />
          )}
          {/* dải chip lịch chỉ ở chế độ Danh sách (timeline đã vẽ khối) */}
          {view === "list" && <ScheduleStrip blocks={scheduleBlocks} />}
          {isToday && <HabitStrip habits={todayHabits} />}

          {view === "timeline" && !isPast ? (
            <>
              <DayTimeline
                isToday={isToday}
                wake={scheduleSettings.wakeTime}
                sleep={scheduleSettings.sleepTime}
                blocks={scheduleBlocks}
                freeSlots={capacity.slots}
                tasks={timelineTasks}
                mitId={mitId}
              />
              {unscheduledTasks.length > 0 && (
                <div className="mt-6">
                  <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Chưa xếp giờ ({unscheduledTasks.length})
                  </p>
                  {unscheduledTasks.map((t) => (
                    <TaskItem
                      key={t.id}
                      task={t}
                      mitId={mitId}
                      freeSlots={capacity.slots}
                    />
                  ))}
                </div>
              )}
            </>
          ) : dtos.length === 0 ? (
            <EmptyState
              icon={ListTodo}
              title={
                isPast
                  ? "Ngày này không có việc nào"
                  : isToday
                    ? "Chưa có việc nào hôm nay"
                    : "Chưa có kế hoạch cho ngày này"
              }
              description={
                isPast ? undefined : "Thêm việc đầu tiên ở ô bên dưới."
              }
              className="py-10"
            />
          ) : (
            <div>
              {dtos.map((t) => (
                <TaskItem key={t.id} task={t} mitId={mitId} />
              ))}
            </div>
          )}
          {/* Quá khứ chỉ để quan sát — không thêm việc ngược thời gian */}
          {!isPast && (
            <div className="mt-1">
              <AddTask date={date} isToday={isToday} hardTopics={hardTopics} />
            </div>
          )}

          {/* Ghi chú nằm CUỐI cột việc → thẳng hàng đúng bằng các thanh todo phía trên */}
          {isToday && (
            <div className="mt-6">
              <NoteBox initialNote={dailyNote?.note ?? ""} />
            </div>
          )}

          {isPast && dailyNote?.note && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium">Ghi chú của ngày này</p>
              <blockquote className="rounded-lg border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground italic">
                “{dailyNote.note}”
              </blockquote>
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <StatsCards
            done={doneCount}
            total={leaves.length}
            velocity={velocity}
          />
          {isToday && (
            <CheckinBox
              initial={{
                energy: checkin?.energy ?? null,
                mood: checkin?.mood ?? null,
                stress: checkin?.stress ?? null,
                sleepHours: checkin?.sleepHours ?? null,
              }}
            />
          )}
          {isToday && planMomentum.length > 0 && (
            <PlanMomentum plans={planMomentum} />
          )}
          {isToday && <SuggestSheet />}
        </aside>
      </div>
    </div>
  );
}
