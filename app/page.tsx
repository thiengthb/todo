import { prisma } from "@/lib/db";
import {
  dayLabel,
  delayDays,
  formatDateVN,
  isValidDateStr,
  todayStr,
} from "@/lib/dates";
import { DayNav } from "@/components/day-nav";
import type { Emotion, TaskDTO } from "@/lib/types";
import { AddTask } from "@/components/today/add-task";
import { NoteBox } from "@/components/today/note-box";
import { StatsCards } from "@/components/today/stats-cards";
import { SuggestDialog } from "@/components/today/suggest-dialog";
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

  const [tasks, dailyNote] = await Promise.all([
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
  ]);

  const dtos: TaskDTO[] = tasks.map((t) => {
    const subtasks: TaskDTO[] = t.subtasks.map((c) => ({
      id: c.id,
      title: c.title,
      done: c.done,
      emotion: c.emotion as Emotion | null,
      delay: c.done || isPast ? 0 : delayDays(c),
      planTitle: c.plan?.title ?? null,
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
    };
  });

  // stats đếm theo việc thật (bước con + việc đơn), bỏ qua container — mục 11
  const leaves = dtos.flatMap((t) => t.subtasks ?? [t]);
  const doneCount = leaves.filter((t) => t.done).length;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground capitalize">
            {formatDateVN(date)}
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight capitalize sm:text-2xl">
            {dayLabel(date)}
          </h1>
        </div>
        <DayNav date={date} today={today} />
      </header>

      <StatsCards done={doneCount} total={leaves.length} />

      <section aria-label="Danh sách việc" className="mt-8">
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
              <TaskItem key={t.id} task={t} />
            ))}
          </div>
        )}
        {/* Quá khứ chỉ để quan sát — không thêm việc ngược thời gian */}
        {!isPast && (
          <div className="mt-1">
            <AddTask date={date} isToday={isToday} />
          </div>
        )}
      </section>

      {isToday && (
        <section className="mt-10">
          <NoteBox initialNote={dailyNote?.note ?? ""} />
        </section>
      )}

      {isPast && dailyNote?.note && (
        <section className="mt-10">
          <p className="mb-2 text-sm font-medium">Ghi chú của ngày này</p>
          <blockquote className="rounded-md border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground italic">
            “{dailyNote.note}”
          </blockquote>
        </section>
      )}

      {isToday && (
        <section className="mt-6">
          <SuggestDialog />
        </section>
      )}
    </main>
  );
}
