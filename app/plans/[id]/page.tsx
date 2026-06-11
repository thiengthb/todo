import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { computePlanProgress } from '@/lib/plan';
import { formatDateShort } from '@/lib/dates';
import type { Intensity, PlanStatus } from '@/lib/types';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BehindAlert } from '@/components/plans/behind-alert';
import { MilestoneList } from '@/components/plans/milestone-list';
import { PlanActions } from '@/components/plans/plan-actions';
import { PageHeader } from '@/components/page-header';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<PlanStatus, string> = {
  active: 'Đang chạy',
  paused: 'Tạm dừng',
  done: 'Hoàn thành',
  archived: 'Lưu trữ',
};

const INTENSITY_LABEL: Record<Intensity, string> = {
  nhẹ: 'Cường độ nhẹ',
  vừa: 'Cường độ vừa',
  dồn: 'Cường độ dồn',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PlanDetailPage({ params }: PageProps) {
  const { id } = await params;
  const plan = await prisma.plan.findUnique({
    where: { id },
    include: {
      milestones: { orderBy: { order: 'asc' } },
      // bỏ task "container" (đã chia nhỏ) khỏi đếm tiến độ việc (mục 11)
      tasks: {
        where: { subtasks: { none: {} } },
        select: { id: true, done: true },
      },
    },
  });
  if (!plan) notFound();

  const status = plan.status as PlanStatus;
  const progress = computePlanProgress(plan, plan.milestones);
  const tasksDone = plan.tasks.filter((t) => t.done).length;
  const behind = status === 'active' && progress.behindDays >= 1;

  return (
    <div className="py-8">
      <PageHeader
        backHref="/plans"
        backLabel="Kế hoạch"
        title={plan.title}
        description={plan.goal}
        action={<PlanActions id={plan.id} status={status} />}
        className="mb-0"
      />

      {/* Trạng thái + cảnh báo chậm — badge nổi, tách khỏi dòng meta để mobile không wrap xấu */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-normal">
          {STATUS_LABEL[status]}
        </Badge>
        {behind && (
          <Badge
            variant="outline"
            className="gap-1 border-amber-300 bg-amber-50 font-normal text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400"
          >
            <AlertTriangle className="size-3" />
            chậm {progress.behindDays}d
          </Badge>
        )}
      </div>

      {/* Dải thông tin: cường độ · thời hạn · còn lại */}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{INTENSITY_LABEL[plan.intensity as Intensity]}</span>
        <span aria-hidden>·</span>
        <span>
          {formatDateShort(plan.startDate)} → {formatDateShort(plan.endDate)}
        </span>
        <span aria-hidden>·</span>
        <span>
          {progress.daysLeft >= 0 ? `còn ${progress.daysLeft}d` : `quá hạn ${-progress.daysLeft}d`}
        </span>
      </div>

      {/* Thanh tiến độ */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">
            {progress.done}/{progress.total} cột mốc
          </span>
          <span className="text-muted-foreground tabular-nums">{progress.progressPct}%</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-foreground transition-all"
            style={{ width: `${progress.progressPct}%` }}
          />
        </div>
        {plan.tasks.length > 0 && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {tasksDone}/{plan.tasks.length} việc thuộc kế hoạch đã xong
          </p>
        )}
      </div>

      {behind && (
        <div className="mt-6">
          <BehindAlert id={plan.id} behindDays={progress.behindDays} />
        </div>
      )}

      {/* Roadmap */}
      <section className="mt-8">
        <h2 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Lộ trình
        </h2>
        <MilestoneList planId={plan.id} milestones={plan.milestones} />
      </section>
    </div>
  );
}
