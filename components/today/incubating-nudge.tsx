'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, Loader2, Plus, Sprout, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreatePlanDialog } from '@/components/plans/create-plan-dialog';
import { promoteGoalToTask } from '@/app/incubating/actions';
import { todayStr } from '@/lib/dates';

interface NudgeGoal {
  id: string;
  title: string;
  approach: 'task' | 'plan';
}

/**
 * "When free" card on the Today page (section 17): when free time is high & Incubating items remain, gently suggest
 * pulling one out to work on. An opportunity, not a push — shows just 1 best-fit item + a link to see the rest.
 */
export function IncubatingNudge({
  goal,
  moreCount,
  freeMin,
}: {
  goal: NudgeGoal;
  moreCount: number;
  freeMin: number;
}) {
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();
  const hours = Math.max(1, Math.round(freeMin / 60));

  return (
    <div className="rounded-lg border border-border/70 p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Sprout className="size-4 text-teal-600 dark:text-teal-400" /> Lúc rảnh
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Hôm nay còn ~{hours}h trống — lấy một điều bạn đang ấp ủ ra làm?
      </p>

      <div className="mt-3 rounded-md border border-border/60 bg-muted/30 p-2.5">
        <p className="text-sm">{goal.title}</p>
        {added ? (
          <p className="mt-2 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="size-3.5" /> Đã thêm vào hôm nay
          </p>
        ) : (
          <div className="mt-2 flex gap-1.5">
            <Button
              size="sm"
              className="flex-1 gap-1"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await promoteGoalToTask(goal.id, { date: todayStr() });
                  setAdded(true);
                })
              }
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <>
                  <Plus className="size-3.5" /> Hôm nay
                </>
              )}
            </Button>
            <CreatePlanDialog
              goalId={goal.id}
              defaultTitle={goal.title}
              defaultGoal={goal.title}
              trigger={
                <Button variant="outline" size="sm" className="gap-1">
                  <Target className="size-3.5" /> Kế hoạch
                </Button>
              }
            />
          </div>
        )}
      </div>

      <Link
        href="/incubating"
        className="mt-2 inline-block text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {moreCount > 0 ? `Xem ${moreCount} điều khác trong Ấp ủ →` : 'Mở Ấp ủ →'}
      </Link>
    </div>
  );
}
