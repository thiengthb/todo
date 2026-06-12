'use client';

import { useState, useTransition } from 'react';
import { Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TimePicker } from '@/components/ui/time-picker';
import { DatePicker } from '@/components/ui/date-picker';
import { Field } from '@/components/field';
import { InfoHint } from '@/components/info-hint';
import { updateScheduleSettings } from '@/app/schedule/actions';
import type { ScheduleSettingsDTO } from '@/lib/types';

/** Wake-hours + buffer settings (section 14) — feeds computeFreeSlots to compute real free time. */
export function ScheduleSettingsForm({ initial }: { initial: ScheduleSettingsDTO }) {
  const [v, setV] = useState(initial);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateScheduleSettings(v);
      if (res.ok) toast.success('Đã lưu cấu hình giờ');
      else toast.error(res.error ?? 'Lưu thất bại');
    });
  }

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-1.5 text-sm font-medium">
        <Clock className="size-4 text-muted-foreground" />
        Giờ thức & quỹ thời gian
        <InfoHint label="Quỹ thời gian là gì?">
          Quỹ giờ rảnh mỗi ngày = giờ thức − lịch cứng − đệm. AI dùng số này để đề xuất việc{' '}
          <strong className="font-medium text-foreground">vừa sức</strong>, không nhồi quá khả năng.
        </InfoHint>
      </h2>
      <div className="grid gap-3 rounded-lg border border-border/70 p-4 sm:grid-cols-2">
        <Field label="Giờ thức dậy">
          <TimePicker
            value={v.wakeTime}
            onChange={(t) => setV({ ...v, wakeTime: t })}
            ariaLabel="Giờ thức dậy"
          />
        </Field>
        <Field label="Giờ đi ngủ">
          <TimePicker
            value={v.sleepTime}
            onChange={(t) => setV({ ...v, sleepTime: t })}
            ariaLabel="Giờ đi ngủ"
          />
        </Field>
        <Field
          label="Đệm giữa lịch (phút)"
          hint="Thời gian di chuyển/nghỉ trước & sau mỗi lịch cứng."
        >
          <Input
            type="number"
            min={0}
            max={120}
            value={v.bufferMin}
            onChange={(e) => setV({ ...v, bufferMin: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field
          label="Khe tối thiểu (phút)"
          hint="Khe trống ngắn hơn ngưỡng này sẽ bị bỏ qua khi xếp việc."
        >
          <Input
            type="number"
            min={0}
            max={240}
            value={v.minSlotMin}
            onChange={(e) => setV({ ...v, minSlotMin: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field
          label="Mốc tuần lẻ (kỳ học)"
          hint="Thứ Hai của tuần 1 trong kỳ — dùng để xác định tuần chẵn/lẻ. Bỏ trống nếu không dùng."
          className="sm:col-span-2"
        >
          <DatePicker
            value={v.termAnchorMonday}
            onChange={(d) => setV({ ...v, termAnchorMonday: d })}
            placeholder="Không dùng tuần chẵn/lẻ"
            clearable
          />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={pending} className="gap-1.5">
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          Lưu
        </Button>
      </div>
    </section>
  );
}
