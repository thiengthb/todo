import { Target } from "lucide-react";
import { prisma } from "@/lib/db";
import { computePlanProgress } from "@/lib/plan";
import type { PlanStatus } from "@/lib/types";
import { CreatePlanDialog } from "@/components/plans/create-plan-dialog";
import { PlanCard } from "@/components/plans/plan-card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

/** Nhãn ngày còn lại từ progress.daysLeft */
function daysLeftLabel(daysLeft: number): string {
  if (daysLeft > 0) return `còn ${daysLeft}d`;
  if (daysLeft === 0) return "hạn hôm nay";
  return `quá hạn ${-daysLeft}d`;
}

// active lên đầu, rồi paused, done, archived
const STATUS_ORDER: Record<PlanStatus, number> = {
  active: 0,
  paused: 1,
  done: 2,
  archived: 3,
};

export default async function PlansPage() {
  const plans = await prisma.plan.findMany({
    include: { milestones: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  const cards = plans
    .map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status as PlanStatus,
      progress: computePlanProgress(p, p.milestones),
    }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  return (
    <div className="py-8">
      <PageHeader
        eyebrow="Mục tiêu dài hạn"
        title="Kế hoạch"
        action={<CreatePlanDialog />}
      />

      {cards.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Chưa có kế hoạch nào"
          description="Tạo một mục tiêu dài hạn — AI sẽ chia thành lộ trình cột mốc và mỗi ngày đề xuất việc bám theo tốc độ thật của bạn."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((c) => (
            <PlanCard
              key={c.id}
              id={c.id}
              title={c.title}
              status={c.status}
              daysLeftLabel={daysLeftLabel(c.progress.daysLeft)}
              progress={c.progress}
            />
          ))}
        </div>
      )}
    </div>
  );
}
