'use client';

import { useState, useTransition } from 'react';
import { ArrowRight, CalendarPlus, Loader2, Target } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DatePicker } from '@/components/ui/date-picker';
import { CreatePlanDialog } from '@/components/plans/create-plan-dialog';
import { promoteGoalToTask } from '@/app/incubating/actions';
import { todayStr, tomorrowStr } from '@/lib/dates';
import type { GoalDTO } from '@/lib/types';

/**
 * Đưa một mục tiêu ra khỏi "Ấp ủ" (mục 17): kéo vào một ngày → Task, hoặc nâng thành Kế hoạch.
 * Cả 2 ngõ luôn hiện; AI chỉ _gợi ý_ cỡ (mục đề xuất ngày mai), người dùng quyết ở đây.
 */
export function PromoteMenu({ goal }: { goal: GoalDTO }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function toTask(date: string) {
    setOpen(false);
    startTransition(async () => {
      await promoteGoalToTask(goal.id, { date });
      toast.success('Đã kéo vào danh sách việc');
    });
  }

  const rowClass =
    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={pending}>
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ArrowRight className="size-3.5" />
          )}
          Đưa vào
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-2">
        <p className="px-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <CalendarPlus className="mr-1 inline size-3.5" /> Kéo vào một ngày
        </p>
        <div className="flex gap-1 px-1 pb-1">
          <Button variant="ghost" size="sm" className="flex-1" onClick={() => toTask(todayStr())}>
            Hôm nay
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() => toTask(tomorrowStr())}
          >
            Ngày mai
          </Button>
        </div>
        <div className="px-1 pb-1">
          <DatePicker value={null} onChange={(d) => d && toTask(d)} placeholder="Ngày khác…" />
        </div>

        <div className="my-1 h-px bg-border/70" />

        <CreatePlanDialog
          goalId={goal.id}
          defaultTitle={goal.title}
          defaultGoal={goal.note ?? goal.title}
          onPromoted={() => setOpen(false)}
          trigger={
            <button type="button" className={rowClass}>
              <Target className="size-4" /> Nâng thành kế hoạch
            </button>
          }
        />
      </PopoverContent>
    </Popover>
  );
}
