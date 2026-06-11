'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GripVertical, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { InfoHint } from '@/components/info-hint';
import { IconTooltip } from '@/components/icon-tooltip';
import { cn } from '@/lib/utils';
import { addDays, todayStr } from '@/lib/dates';
import { createPlan } from '@/app/actions';
import type { DecomposeResult, Intensity, MilestoneDraft } from '@/lib/types';

const INTENSITIES: { value: Intensity; label: string; hint: string }[] = [
  { value: 'nhẹ', label: 'Nhẹ', hint: 'ít mốc, mỗi mốc nhỏ' },
  { value: 'vừa', label: 'Vừa', hint: 'cân bằng' },
  { value: 'dồn', label: 'Dồn', hint: 'nhiều mốc, dày hơn' },
];

const DURATIONS = [14, 30, 60, 90];

export function CreatePlanDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState(todayStr());
  const [duration, setDuration] = useState(30);
  const [intensity, setIntensity] = useState<Intensity>('vừa');

  const [milestones, setMilestones] = useState<MilestoneDraft[] | null>(null);
  const [decomposing, setDecomposing] = useState(false);
  const [saving, startSave] = useTransition();

  const endDate = addDays(startDate, duration);

  function reset() {
    setTitle('');
    setGoal('');
    setStartDate(todayStr());
    setDuration(30);
    setIntensity('vừa');
    setMilestones(null);
  }

  async function decompose() {
    if (!title.trim() || !goal.trim()) {
      toast.error('Cần tiêu đề và mục tiêu trước khi tạo lộ trình');
      return;
    }
    setDecomposing(true);
    try {
      const res = await fetch('/api/plan/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, goal, startDate, endDate, intensity }),
      });
      const data = (await res.json()) as DecomposeResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Lỗi ${res.status}`);
      setMilestones(data.milestones);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không tạo được lộ trình');
    } finally {
      setDecomposing(false);
    }
  }

  function save() {
    if (!milestones) return;
    const clean = milestones.filter((m) => m.title.trim());
    if (clean.length === 0) {
      toast.error('Cần ít nhất một cột mốc');
      return;
    }
    startSave(async () => {
      try {
        const id = await createPlan({
          title,
          goal,
          startDate,
          endDate,
          intensity,
          milestones: clean,
        });
        toast.success('Đã tạo kế hoạch');
        setOpen(false);
        reset();
        router.push(`/plans/${id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Không lưu được kế hoạch');
      }
    });
  }

  function editMilestone(i: number, value: string) {
    setMilestones((prev) =>
      prev ? prev.map((m, j) => (j === i ? { ...m, title: value } : m)) : prev,
    );
  }

  function removeMilestone(i: number) {
    setMilestones((prev) =>
      prev ? prev.filter((_, j) => j !== i).map((m, j) => ({ ...m, order: j + 1 })) : prev,
    );
  }

  function addMilestone() {
    setMilestones((prev) => [
      ...(prev ?? []),
      { title: '', order: (prev?.length ?? 0) + 1, targetDate: null },
    ]);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" /> Kế hoạch mới
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Kế hoạch mới</DialogTitle>
          <DialogDescription>
            Đặt mục tiêu dài hạn — AI chia thành lộ trình cột mốc, mỗi ngày rót việc theo tốc độ
            thật của bạn.
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            'max-h-[72vh] space-y-4 overflow-y-auto pr-1',
            milestones &&
              'sm:grid sm:grid-cols-2 sm:gap-5 sm:space-y-0 sm:overflow-visible sm:pr-0',
          )}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tên kế hoạch</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Học tiếng Nhật cơ bản"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Mục tiêu — bạn muốn đạt được gì?
              </label>
              <Textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="VD: Đọc viết được Hiragana/Katakana và 100 từ vựng cơ bản, nói được câu chào hỏi."
                rows={3}
              />
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Bắt đầu</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-auto"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Kéo dài</label>
                <div className="flex gap-1">
                  {DURATIONS.map((d) => (
                    <Button
                      key={d}
                      type="button"
                      size="sm"
                      variant={duration === d ? 'default' : 'outline'}
                      onClick={() => setDuration(d)}
                    >
                      {d}d
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                Cường độ
                <InfoHint label="Cường độ là gì?">
                  Quyết định lộ trình dày hay thưa:{' '}
                  <strong className="font-medium text-foreground">nhẹ</strong> = ít cột mốc, mỗi mốc
                  nhỏ; <strong className="font-medium text-foreground">dồn</strong> = nhiều cột mốc,
                  dày hơn; <strong className="font-medium text-foreground">vừa</strong> ở giữa.
                </InfoHint>
              </span>
              <div className="flex gap-1">
                {INTENSITIES.map((it) => (
                  <IconTooltip key={it.value} label={it.hint}>
                    <Button
                      type="button"
                      size="sm"
                      variant={intensity === it.value ? 'default' : 'outline'}
                      onClick={() => setIntensity(it.value)}
                      className="flex-1"
                    >
                      {it.label}
                    </Button>
                  </IconTooltip>
                ))}
              </div>
            </div>
          </div>

          {/* Roadmap xem trước — chỉnh được trước khi lưu (cột phải khi đã có) */}
          {milestones && (
            <div className="space-y-2 rounded-md border border-border/70 bg-muted/30 p-3 sm:max-h-[60vh] sm:overflow-y-auto">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Lộ trình ({milestones.length} cột mốc) — chỉnh tuỳ ý
              </p>
              {milestones.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <GripVertical className="size-3.5 shrink-0 text-muted-foreground/50" />
                  <span className="w-5 shrink-0 text-center text-xs text-muted-foreground tabular-nums">
                    {i + 1}
                  </span>
                  <Input
                    value={m.title}
                    onChange={(e) => editMilestone(i, e.target.value)}
                    className="h-8 text-sm"
                  />
                  <button
                    type="button"
                    aria-label="Xoá cột mốc"
                    onClick={() => removeMilestone(i)}
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addMilestone}
                className="text-muted-foreground"
              >
                <Plus className="size-3.5" /> Thêm cột mốc
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          {!milestones ? (
            <Button onClick={decompose} disabled={decomposing} className="gap-2">
              {decomposing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Tạo lộ trình
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={decompose}
                disabled={decomposing}
                className={cn('gap-2 text-muted-foreground', decomposing && 'opacity-70')}
              >
                {decomposing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Tạo lại
              </Button>
              <Button onClick={save} disabled={saving} className="gap-2">
                {saving && <Loader2 className="size-4 animate-spin" />}
                Lưu kế hoạch
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
