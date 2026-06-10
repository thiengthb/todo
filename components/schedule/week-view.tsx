"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { formatDateVN, weekdayShortVN } from "@/lib/dates";
import { SCHEDULE_KINDS, formatMinutes } from "@/lib/schedule";
import {
  addCommitment,
  addScheduleEvent,
  deleteCommitment,
  deleteScheduleEvent,
  setCommitmentActive,
  updateCommitment,
} from "@/app/schedule/actions";
import type {
  CommitmentDTO,
  ScheduleBlock,
  ScheduleEventDTO,
  ScheduleKind,
} from "@/lib/types";

export interface DayColumn {
  date: string;
  dow: number;
  label: string;
  dateShort: string;
  isToday: boolean;
  blocks: ScheduleBlock[];
  freeMin: number;
}

const KIND_LABEL: Record<ScheduleKind, string> = {
  hoc: "Học",
  lam: "Làm",
  khac: "Khác",
};

// nền trung tính + viền trái nhạt theo loại (giữ tinh thần §12: không accent chói)
const KIND_BORDER: Record<ScheduleKind, string> = {
  hoc: "border-l-sky-400/70",
  lam: "border-l-violet-400/70",
  khac: "border-l-border",
};

// thứ tự T2..CN cho lưới (getDay: 1..6,0)
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

type Editing =
  | { kind: "new" }
  | { kind: "new-commitment"; dayOfWeek: number }
  | { kind: "new-event"; date: string }
  | { kind: "edit-commitment"; data: CommitmentDTO }
  | { kind: "edit-event"; data: ScheduleEventDTO };

function blockTimeLabel(b: ScheduleBlock): string {
  if (!b.startTime || !b.endTime) return "Cả ngày";
  return `${b.startTime}–${b.endTime}`;
}

export function WeekView({
  weekStart,
  prevStart,
  nextStart,
  thisStart,
  days,
  commitments,
  events,
}: {
  weekStart: string;
  prevStart: string;
  nextStart: string;
  thisStart: string;
  days: DayColumn[];
  commitments: CommitmentDTO[];
  events: ScheduleEventDTO[];
}) {
  const [editing, setEditing] = useState<Editing | null>(null);

  // tra ngược object gốc khi bấm vào một khối trong lưới
  function openBlock(b: ScheduleBlock) {
    if (b.source === "commitment") {
      const c = commitments.find((x) => x.id === b.id);
      if (c) setEditing({ kind: "edit-commitment", data: c });
    } else {
      const e = events.find((x) => x.id === b.id);
      if (e) setEditing({ kind: "edit-event", data: e });
    }
  }

  return (
    <div className="space-y-10">
      {/* Thanh điều hướng tuần */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            asChild
            aria-label="Tuần trước"
          >
            <Link href={`/schedule?start=${prevStart}`}>
              <ChevronLeft />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            asChild
            aria-label="Tuần sau"
          >
            <Link href={`/schedule?start=${nextStart}`}>
              <ChevronRight />
            </Link>
          </Button>
          {weekStart !== thisStart && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/schedule?start=${thisStart}`}>Tuần này</Link>
            </Button>
          )}
          <span className="ml-1 text-sm text-muted-foreground">
            Tuần {formatDateVN(days[0].date).replace(/^[^,]+,\s*/, "")} –{" "}
            {formatDateVN(days[6].date).replace(/^[^,]+,\s*/, "")}
          </span>
        </div>
        <Button size="sm" onClick={() => setEditing({ kind: "new" })}>
          <Plus /> Thêm lịch
        </Button>
      </div>

      {/* Lưới 7 cột (desktop) / xếp dọc (mobile) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((d) => (
          <div
            key={d.date}
            className={cn(
              "flex min-h-40 flex-col rounded-lg border border-border/70 p-2",
              d.isToday && "border-foreground/40 bg-muted/30",
            )}
          >
            <div className="mb-2 flex items-baseline justify-between px-1">
              <span
                className={cn(
                  "text-sm font-medium",
                  d.isToday && "text-foreground",
                )}
              >
                {d.label}
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {d.dateShort}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-1.5">
              {d.blocks.length === 0 && (
                <p className="px-1 py-2 text-[11px] text-muted-foreground/60">
                  Trống
                </p>
              )}
              {d.blocks.map((b) => (
                <button
                  key={`${b.source}-${b.id}`}
                  type="button"
                  onClick={() => openBlock(b)}
                  className={cn(
                    "rounded-md border border-l-2 border-border/60 bg-muted/40 px-2 py-1.5 text-left transition-colors hover:bg-muted",
                    KIND_BORDER[b.kind],
                  )}
                >
                  <span className="block truncate text-xs font-medium">
                    {b.title}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="size-2.5 shrink-0" />
                    {blockTimeLabel(b)}
                    {b.source === "event" && (
                      <span className="text-muted-foreground/70">
                        · đột xuất
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-border/60 px-1 pt-1.5">
              <span className="text-[10px] text-muted-foreground">
                rảnh ~{formatMinutes(d.freeMin)}
              </span>
              <button
                type="button"
                aria-label={`Thêm vào ${d.label}`}
                onClick={() =>
                  setEditing({ kind: "new-commitment", dayOfWeek: d.dow })
                }
                className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Quản lý lịch cứng (gồm cả lịch đang tắt) */}
      <CommitmentManager
        commitments={commitments}
        onEdit={(c) => setEditing({ kind: "edit-commitment", data: c })}
      />

      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      >
        <DialogContent className="sm:max-w-md">
          {editing && (
            <ScheduleForm
              key={JSON.stringify(editing)}
              editing={editing}
              weekStart={weekStart}
              onClose={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────── Quản lý lịch cứng ───────── */

function CommitmentManager({
  commitments,
  onEdit,
}: {
  commitments: CommitmentDTO[];
  onEdit: (c: CommitmentDTO) => void;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (commitments.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Lịch cứng theo tuần</h2>
        <EmptyState
          icon={CalendarOff}
          title="Chưa có lịch cứng nào"
          description="Bấm “Thêm lịch” để khai báo lịch học/làm lặp theo tuần — quỹ giờ rảnh sẽ được tính tự động."
          className="py-10"
        />
      </section>
    );
  }

  // nhóm theo thứ, sắp T2..CN
  const byDow = [...commitments].sort(
    (a, b) =>
      WEEK_ORDER.indexOf(a.dayOfWeek) - WEEK_ORDER.indexOf(b.dayOfWeek) ||
      a.startTime.localeCompare(b.startTime),
  );

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">
        Lịch cứng theo tuần{" "}
        <span className="font-normal text-muted-foreground">
          ({commitments.length})
        </span>
      </h2>
      <div className="rounded-lg border border-border/70">
        {byDow.map((c, i) => (
          <div
            key={c.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40",
              i < byDow.length - 1 && "border-b border-border/70",
              !c.active && "opacity-50",
            )}
          >
            <span className="w-8 shrink-0 text-xs font-medium text-muted-foreground">
              {weekdayShortVN(c.dayOfWeek)}
            </span>
            <span className="w-24 shrink-0 text-xs text-muted-foreground tabular-nums">
              {c.startTime}–{c.endTime}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{c.title}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {KIND_LABEL[c.kind]}
            </span>
            <Switch
              checked={c.active}
              aria-label="Bật/tắt lịch"
              onCheckedChange={(v) => {
                setPendingId(c.id);
                startTransition(async () => {
                  await setCommitmentActive(c.id, v);
                  setPendingId(null);
                });
              }}
            />
            <button
              type="button"
              aria-label="Sửa"
              onClick={() => onEdit(c)}
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Xoá"
              disabled={pendingId === c.id}
              onClick={() => {
                setPendingId(c.id);
                startTransition(async () => {
                  await deleteCommitment(c.id);
                  toast.success("Đã xoá lịch");
                  setPendingId(null);
                });
              }}
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────── Form thêm/sửa ───────── */

type FormType = "commitment" | "event";
type EventMode = "timed" | "allday" | "off";

function ScheduleForm({
  editing,
  weekStart,
  onClose,
}: {
  editing: Editing;
  weekStart: string;
  onClose: () => void;
}) {
  const editingCommitment =
    editing.kind === "edit-commitment" ? editing.data : null;
  const editingEvent = editing.kind === "edit-event" ? editing.data : null;

  // loại form: cố định khi sửa; khi thêm thì chọn được (mặc định theo ngữ cảnh)
  const initialType: FormType =
    editing.kind === "edit-event" || editing.kind === "new-event"
      ? "event"
      : "commitment";
  const [type, setType] = useState<FormType>(initialType);
  const isEdit =
    editing.kind === "edit-commitment" || editing.kind === "edit-event";

  const [title, setTitle] = useState(
    editingCommitment?.title ?? editingEvent?.title ?? "",
  );
  const [kind, setKind] = useState<ScheduleKind>(
    editingCommitment?.kind ?? editingEvent?.kind ?? "hoc",
  );
  // commitment
  const [dayOfWeek, setDayOfWeek] = useState<number>(
    editingCommitment?.dayOfWeek ??
      (editing.kind === "new-commitment" ? editing.dayOfWeek : 1),
  );
  const [start, setStart] = useState(editingCommitment?.startTime ?? "08:00");
  const [end, setEnd] = useState(editingCommitment?.endTime ?? "10:00");
  // event
  const [date, setDate] = useState(
    editingEvent?.date ??
      (editing.kind === "new-event" ? editing.date : weekStart),
  );
  const [eventMode, setEventMode] = useState<EventMode>(
    editingEvent
      ? editingEvent.cancels
        ? "off"
        : editingEvent.startTime
          ? "timed"
          : "allday"
      : "timed",
  );
  const [evStart, setEvStart] = useState(editingEvent?.startTime ?? "09:00");
  const [evEnd, setEvEnd] = useState(editingEvent?.endTime ?? "11:00");

  const [saving, startSave] = useTransition();

  function submit() {
    startSave(async () => {
      let res: { ok: boolean; error?: string };
      if (type === "commitment") {
        const payload = {
          title,
          dayOfWeek,
          startTime: start,
          endTime: end,
          kind,
        };
        res = editingCommitment
          ? await updateCommitment(editingCommitment.id, payload)
          : await addCommitment(payload);
      } else {
        const timed = eventMode === "timed";
        res = await addScheduleEvent({
          title: title || (eventMode === "off" ? "Nghỉ" : ""),
          date,
          startTime: timed ? evStart : null,
          endTime: timed ? evEnd : null,
          kind,
          cancels: eventMode === "off",
        });
      }
      if (res.ok) {
        toast.success(isEdit ? "Đã cập nhật" : "Đã thêm");
        onClose();
      } else {
        toast.error(res.error ?? "Không lưu được");
      }
    });
  }

  function removeEvent() {
    if (!editingEvent) return;
    startSave(async () => {
      await deleteScheduleEvent(editingEvent.id);
      toast.success("Đã xoá");
      onClose();
    });
  }

  const title_ =
    editing.kind === "edit-commitment"
      ? "Sửa lịch cứng"
      : editing.kind === "edit-event"
        ? "Sửa sự kiện"
        : "Thêm vào lịch";

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title_}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {/* chọn loại — chỉ khi thêm mới */}
        {!isEdit && (
          <div className="flex gap-1">
            <SegBtn
              active={type === "commitment"}
              onClick={() => setType("commitment")}
            >
              Lặp theo tuần
            </SegBtn>
            <SegBtn active={type === "event"} onClick={() => setType("event")}>
              Đột xuất / một lần
            </SegBtn>
          </div>
        )}

        {/* tên — ẩn khi là "nghỉ cả ngày" (không cần) */}
        {!(type === "event" && eventMode === "off") && (
          <Field label={type === "commitment" ? "Tên lịch" : "Tên sự kiện"}>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === "commitment"
                  ? "VD: Toán cao cấp / Ca làm sáng"
                  : "VD: Họp nhóm, khám răng…"
              }
              autoFocus
            />
          </Field>
        )}

        {type === "commitment" ? (
          <>
            <Field label="Thứ trong tuần">
              <div className="flex flex-wrap gap-1">
                {WEEK_ORDER.map((dw) => (
                  <SegBtn
                    key={dw}
                    active={dayOfWeek === dw}
                    onClick={() => setDayOfWeek(dw)}
                  >
                    {weekdayShortVN(dw)}
                  </SegBtn>
                ))}
              </div>
            </Field>
            <TimeRange
              start={start}
              end={end}
              onStart={setStart}
              onEnd={setEnd}
            />
          </>
        ) : (
          <>
            <Field label="Ngày">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-auto"
              />
            </Field>
            <Field label="Kiểu">
              <div className="flex gap-1">
                <SegBtn
                  active={eventMode === "timed"}
                  onClick={() => setEventMode("timed")}
                >
                  Có giờ
                </SegBtn>
                <SegBtn
                  active={eventMode === "allday"}
                  onClick={() => setEventMode("allday")}
                >
                  Cả ngày
                </SegBtn>
                <SegBtn
                  active={eventMode === "off"}
                  onClick={() => setEventMode("off")}
                >
                  <CalendarOff className="size-3.5" /> Nghỉ
                </SegBtn>
              </div>
            </Field>
            {eventMode === "off" && (
              <p className="text-xs text-muted-foreground">
                Đánh dấu nghỉ cả ngày này — mọi lịch cứng hôm đó sẽ được bỏ qua
                khi tính quỹ giờ rảnh.
              </p>
            )}
            {eventMode === "timed" && (
              <TimeRange
                start={evStart}
                end={evEnd}
                onStart={setEvStart}
                onEnd={setEvEnd}
              />
            )}
          </>
        )}

        {/* loại (kind) — không cần cho "nghỉ" */}
        {!(type === "event" && eventMode === "off") && (
          <Field label="Phân loại">
            <div className="flex gap-1">
              {SCHEDULE_KINDS.map((k) => (
                <SegBtn
                  key={k.value}
                  active={kind === k.value}
                  onClick={() => setKind(k.value)}
                >
                  {k.label}
                </SegBtn>
              ))}
            </div>
          </Field>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        {editingEvent ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={removeEvent}
            disabled={saving}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" /> Xoá
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {isEdit ? "Lưu" : "Thêm"}
          </Button>
        </div>
      </div>
    </>
  );
}

function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function TimeRange({
  start,
  end,
  onStart,
  onEnd,
}: {
  start: string;
  end: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="time"
        value={start}
        onChange={(e) => onStart(e.target.value)}
        className="w-28"
      />
      <span className="text-muted-foreground">→</span>
      <Input
        type="time"
        value={end}
        onChange={(e) => onEnd(e.target.value)}
        className="w-28"
      />
    </div>
  );
}
