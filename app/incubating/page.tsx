import { Sprout } from 'lucide-react';
import { prisma } from '@/lib/db';
import { todayStr } from '@/lib/dates';
import { goalAgeDays, isStale } from '@/lib/queue';
import type { GoalDTO, GoalStatus } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { CaptureInput } from '@/components/incubating/capture-input';
import { GoalCard } from '@/components/incubating/goal-card';
import { DroppedSection } from '@/components/incubating/dropped-section';

export const dynamic = 'force-dynamic';

export default async function IncubatingPage() {
  const today = todayStr();
  const goals = await prisma.goal.findMany({
    where: { status: { in: ['incubating', 'dropped'] } },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
  });

  const toDTO = (g: (typeof goals)[number]): GoalDTO => ({
    id: g.id,
    title: g.title,
    note: g.note,
    status: g.status as GoalStatus,
    pinned: g.pinned,
    snoozedUntil: g.snoozedUntil,
    ageDays: goalAgeDays(g, today),
    isStale: isStale(g, today),
  });

  const incubating = goals.filter((g) => g.status === 'incubating').map(toDTO);
  const dropped = goals.filter((g) => g.status === 'dropped').map(toDTO);

  return (
    <div className="py-8">
      <PageHeader
        eyebrow="Mục tiêu chưa cam kết"
        title="Ấp ủ"
        info={
          <>
            Nơi trút những điều bạn{' '}
            <strong className="font-medium text-foreground">muốn làm</strong> nhưng chưa thể xử lý
            ngay — để đầu óc nhẹ đi. Khi sẵn sàng, hãy{' '}
            <strong className="font-medium text-foreground">kéo vào một ngày</strong> (thành việc)
            hoặc <strong className="font-medium text-foreground">nâng thành kế hoạch</strong> (việc
            lớn, nhiều bước). Không có deadline, không tính vào streak — không áp lực.
          </>
        }
      />

      <div className="space-y-10">
        <section className="space-y-4">
          <CaptureInput />
          {incubating.length === 0 ? (
            <EmptyState
              icon={Sprout}
              title="Chưa ấp ủ điều gì"
              description="Gõ một mục tiêu ở trên rồi Enter. Sau này lúc rảnh, app sẽ nhẹ nhàng nhắc bạn lấy ra làm."
            />
          ) : (
            <div className="rounded-lg border border-border/70">
              {incubating.map((g) => (
                <GoalCard key={g.id} goal={g} />
              ))}
            </div>
          )}
        </section>

        {dropped.length > 0 && <DroppedSection goals={dropped} />}
      </div>
    </div>
  );
}
