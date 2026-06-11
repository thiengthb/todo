'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, MoreHorizontal, Pause, Play, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { deletePlan, setPlanStatus } from '@/app/actions';
import type { PlanStatus } from '@/lib/types';

export function PlanActions({ id, status }: { id: string; status: PlanStatus }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, startTransition] = useTransition();

  function changeStatus(next: PlanStatus) {
    setOpen(false);
    startTransition(() => setPlanStatus(id, next));
  }

  function remove() {
    setOpen(false);
    startTransition(async () => {
      await deletePlan(id);
      toast.success('Đã xoá kế hoạch');
      router.push('/plans');
    });
  }

  const rowClass =
    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors hover:bg-muted';

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setConfirmDelete(false);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Tuỳ chọn kế hoạch">
          <MoreHorizontal className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1">
        {status === 'active' ? (
          <button type="button" className={rowClass} onClick={() => changeStatus('paused')}>
            <Pause className="size-4" /> Tạm dừng
          </button>
        ) : (
          status !== 'done' && (
            <button type="button" className={rowClass} onClick={() => changeStatus('active')}>
              <Play className="size-4" /> Tiếp tục
            </button>
          )
        )}

        {status !== 'done' && (
          <button type="button" className={rowClass} onClick={() => changeStatus('done')}>
            <CheckCircle2 className="size-4" /> Đánh dấu hoàn thành
          </button>
        )}

        {confirmDelete ? (
          <button type="button" className={`${rowClass} text-destructive`} onClick={remove}>
            <Trash2 className="size-4" /> Chắc chắn xoá?
          </button>
        ) : (
          <button
            type="button"
            className={`${rowClass} text-destructive`}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" /> Xoá kế hoạch
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
