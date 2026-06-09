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
import type { Emotion, Priority, TaskDTO } from "@/lib/types";
import { AddTask } from "@/components/today/add-task";
import { CheckinBox } from "@/components/today/checkin-box";
import { NoteBox } from "@/components/today/note-box";
import { StatsCards } from "@/components/today/stats-cards";
import { SuggestSheet } from "@/components/today/suggest-sheet";
import { TaskItem } from "@/components/today/task-item";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function DayPage({ searchParams }: PageProps) {
  const { date: raw } = await searchParams;
  const today = todayStr();
  const date = raw && isValidDateStr(raw) ? raw : today;
  // chuỗi ISO so sánh từ điển = so sánh thời gian
  const isToday = date === today;
  const isPast = date < today;

  const [tasks, dailyNote, checkin, recentDone7] = await Promise.all([
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
  ]);

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

      {/* Dashboard 2 cột: việc (trái) · thống kê/check-in/đề xuất (phải) */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-label="Danh sách việc" className="min-w-0">
          {dtos.length === 0 ? (
            <p className="border-b border-border/70 py-6 text-center text-sm text-muted-foreground">
              {isPast
                ? "Ngày này không có việc nào."
                : isToday
                  ? "Chưa có việc nào — thêm việc đầu tiên bên dưới."
                  : "Chưa có kế hoạch cho ngày này — thêm trước bên dưới."}
            </p>
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
              <AddTask date={date} isToday={isToday} />
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
          <StatsCards done={doneCount} total={leaves.length} />
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
          {isToday && <SuggestSheet />}
        </aside>
      </div>
    </div>
  );
}
