"use client";

import { useState, useTransition } from "react";
import { Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InfoHint } from "@/components/info-hint";
import { updateScheduleSettings } from "@/app/schedule/actions";
import type { ScheduleSettingsDTO } from "@/lib/types";

/** Cấu hình giờ thức + buffer (mục 14) — nuôi computeFreeSlots tính quỹ giờ rảnh thật. */
export function ScheduleSettingsForm({
  initial,
}: {
  initial: ScheduleSettingsDTO;
}) {
  const [v, setV] = useState(initial);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateScheduleSettings(v);
      if (res.ok) toast.success("Đã lưu cấu hình giờ");
      else toast.error(res.error ?? "Lưu thất bại");
    });
  }

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-1.5 text-sm font-medium">
        <Clock className="size-4 text-muted-foreground" />
        Giờ thức & quỹ thời gian
        <InfoHint label="Quỹ thời gian là gì?">
          Quỹ giờ rảnh mỗi ngày = giờ thức − lịch cứng − đệm. AI dùng số này để
          đề xuất việc{" "}
          <strong className="font-medium text-foreground">vừa sức</strong>,
          không nhồi quá khả năng.
        </InfoHint>
      </h2>
      <div className="grid gap-3 rounded-lg border border-border/70 p-4 sm:grid-cols-2">
        <Field label="Giờ thức dậy">
          <Input
            type="time"
            value={v.wakeTime}
            onChange={(e) => setV({ ...v, wakeTime: e.target.value })}
            className="w-32"
          />
        </Field>
        <Field label="Giờ đi ngủ">
          <Input
            type="time"
            value={v.sleepTime}
            onChange={(e) => setV({ ...v, sleepTime: e.target.value })}
            className="w-32"
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
            onChange={(e) =>
              setV({ ...v, bufferMin: Number(e.target.value) || 0 })
            }
            className="w-24"
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
            onChange={(e) =>
              setV({ ...v, minSlotMin: Number(e.target.value) || 0 })
            }
            className="w-24"
          />
        </Field>
        <Field
          label="Mốc tuần lẻ (kỳ học)"
          hint="Thứ Hai của tuần 1 trong kỳ — dùng để xác định tuần chẵn/lẻ. Bỏ trống nếu không dùng."
        >
          <Input
            type="date"
            value={v.termAnchorMonday ?? ""}
            onChange={(e) =>
              setV({ ...v, termAnchorMonday: e.target.value || null })
            }
            className="w-40"
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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
      {hint && (
        <span className="text-[11px] text-muted-foreground/80">{hint}</span>
      )}
    </label>
  );
}
