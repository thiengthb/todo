"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Move,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { TimePicker } from "@/components/ui/time-picker";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { InfoHint } from "@/components/info-hint";
import { formatDateVN, weekdayShortVN } from "@/lib/dates";
import { SCHEDULE_KINDS } from "@/lib/schedule";
import { WeekGrid, type GridChange } from "@/components/schedule/week-grid";
import {
  addCommitment,
  addScheduleEvent,
  addSoftBlock,
  deleteCommitment,
  deleteScheduleEvent,
  deleteSoftBlock,
  setCommitmentActive,
  setSoftBlockActive,
  updateCommitment,
  updateScheduleEvent,
  updateSoftBlock,
} from "@/app/schedule/actions";
import type {
  CommitmentDTO,
  FreeSlot,
  ScheduleBlock,
  ScheduleEventDTO,
  ScheduleKind,
  SoftBlockDTO,
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

// thứ tự T2..CN cho lưới (getDay: 1..6,0)
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

type Editing =
  | { kind: "new" }
  | { kind: "new-commitment"; dayOfWeek: number }
  | { kind: "new-soft"; dayOfWeek: number }
  | { kind: "new-event"; date: string }
  | {
      kind: "new-from-grid";
      date: string;
      dayOfWeek: number;
      start: string;
      end: string;
    }
  | { kind: "edit-commitment"; data: CommitmentDTO }
  | { kind: "edit-soft"; data: SoftBlockDTO }
  | { kind: "edit-event"; data: ScheduleEventDTO };

export function WeekView({
  weekStart,
  prevStart,
  nextStart,
  thisStart,
  days,
  commitments,
  softBlocks,
  events,
  wake,
  sleep,
  freeSlotsByDate,
}: {
  weekStart: string;
  prevStart: string;
  nextStart: string;
  thisStart: string;
  days: DayColumn[];
  commitments: CommitmentDTO[];
  softBlocks: SoftBlockDTO[];
  events: ScheduleEventDTO[];
  wake: string;
  sleep: string;
  freeSlotsByDate: Record<string, FreeSlot[]>;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [, startGridTransition] = useTransition();

  // tra ngược object gốc khi bấm vào một khối trong lưới
  function openBlock(b: ScheduleBlock) {
    if (b.source === "commitment") {
      const c = commitments.find((x) => x.id === b.id);
      if (c) setEditing({ kind: "edit-commitment", data: c });
    } else if (b.source === "soft") {
      const s = softBlocks.find((x) => x.id === b.id);
      if (s) setEditing({ kind: "edit-soft", data: s });
    } else {
      const e = events.find((x) => x.id === b.id);
      if (e) setEditing({ kind: "edit-event", data: e });
    }
  }

  // kéo-thả lịch trên lưới → gửi lại ĐẦY ĐỦ field (giữ parity/validity), chỉ đổi hình học
  function handleMoveResize(block: ScheduleBlock, change: GridChange) {
    startGridTransition(async () => {
      let res: { ok: boolean; error?: string };
      if (block.source === "commitment") {
        const c = commitments.find((x) => x.id === block.id);
        if (!c) return;
        res = await updateCommitment(c.id, {
          title: c.title,
          kind: c.kind,
          dayOfWeek: change.dayOfWeek,
          startTime: change.start,
          endTime: change.end,
          validFrom: c.validFrom,
          validUntil: c.validUntil,
          weekParity: c.weekParity,
        });
      } else if (block.source === "soft") {
        const s = softBlocks.find((x) => x.id === block.id);
        if (!s) return;
        res = await updateSoftBlock(s.id, {
          title: s.title,
          kind: s.kind,
          dayOfWeek: change.dayOfWeek,
          startTime: change.start,
          endTime: change.end,
          validFrom: s.validFrom,
          validUntil: s.validUntil,
          weekParity: s.weekParity,
        });
      } else {
        const ev = events.find((x) => x.id === block.id);
        if (!ev) return;
        res = await updateScheduleEvent(ev.id, {
          title: ev.title,
          kind: ev.kind,
          cancels: ev.cancels,
          date: change.date,
          startTime: change.start,
          endTime: change.end,
        });
      }
      if (!res.ok) toast.error(res.error ?? "Không lưu được");
    });
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

      {/* Lưới giờ kiểu Google Calendar — kéo-tạo + kéo-dời/resize */}
      <WeekGrid
        days={days}
        wake={wake}
        sleep={sleep}
        freeSlotsByDate={freeSlotsByDate}
        onOpen={openBlock}
        onMoveResize={handleMoveResize}
        onCreate={(draft) =>
          setEditing({
            kind: "new-from-grid",
            date: draft.date,
            dayOfWeek: draft.dayOfWeek,
            start: draft.start,
            end: draft.end,
          })
        }
      />

      {/* Quản lý lịch cứng (gồm cả lịch đang tắt) */}
      <CommitmentManager
        commitments={commitments}
        onEdit={(c) => setEditing({ kind: "edit-commitment", data: c })}
      />

      {/* Quản lý khung giờ mềm (time-blocking) */}
      <SoftBlockManager
        softBlocks={softBlocks}
        onEdit={(s) => setEditing({ kind: "edit-soft", data: s })}
        onAdd={() => setEditing({ kind: "new-soft", dayOfWeek: 1 })}
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

/* ───────── Quản lý khung giờ mềm (time-blocking) ───────── */

function SoftBlockManager({
  softBlocks,
  onEdit,
  onAdd,
}: {
  softBlocks: SoftBlockDTO[];
  onEdit: (s: SoftBlockDTO) => void;
  onAdd: () => void;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const header = (
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-1.5 text-sm font-medium">
        <Move className="size-4 text-muted-foreground" />
        Khung giờ tập trung{" "}
        {softBlocks.length > 0 && (
          <span className="font-normal text-muted-foreground">
            ({softBlocks.length})
          </span>
        )}
        <InfoHint label="Khung giờ tập trung là gì?">
          Khung giờ lặp theo tuần bạn{" "}
          <strong className="font-medium text-foreground">muốn</strong> dành cho
          một việc (vd 20–22h học). Khác lịch cứng: nó{" "}
          <strong className="font-medium text-foreground">dời được</strong> và
          không bị trừ khỏi quỹ giờ rảnh — chỉ gợi ý cho AI biết bạn ưu tiên
          khung nào.
        </InfoHint>
      </h2>
      <Button variant="outline" size="sm" onClick={onAdd}>
        <Plus /> Thêm khung
      </Button>
    </div>
  );

  if (softBlocks.length === 0) {
    return (
      <section className="space-y-3">
        {header}
        <EmptyState
          icon={Move}
          title="Chưa có khung giờ tập trung nào"
          description="Khai báo các khung giờ lặp bạn muốn dành cho việc quan trọng — AI sẽ ưu tiên xếp việc vào đó."
          className="py-10"
        />
      </section>
    );
  }

  const byDow = [...softBlocks].sort(
    (a, b) =>
      WEEK_ORDER.indexOf(a.dayOfWeek) - WEEK_ORDER.indexOf(b.dayOfWeek) ||
      a.startTime.localeCompare(b.startTime),
  );

  return (
    <section className="space-y-3">
      {header}
      <div className="rounded-lg border border-border/70">
        {byDow.map((s, i) => (
          <div
            key={s.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40",
              i < byDow.length - 1 && "border-b border-border/70",
              !s.active && "opacity-50",
            )}
          >
            <span className="w-8 shrink-0 text-xs font-medium text-muted-foreground">
              {weekdayShortVN(s.dayOfWeek)}
            </span>
            <span className="w-24 shrink-0 text-xs text-muted-foreground tabular-nums">
              {s.startTime}–{s.endTime}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{s.title}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {KIND_LABEL[s.kind]}
            </span>
            <Switch
              checked={s.active}
              aria-label="Bật/tắt khung"
              onCheckedChange={(v) => {
                setPendingId(s.id);
                startTransition(async () => {
                  await setSoftBlockActive(s.id, v);
                  setPendingId(null);
                });
              }}
            />
            <button
              type="button"
              aria-label="Sửa"
              onClick={() => onEdit(s)}
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Xoá"
              disabled={pendingId === s.id}
              onClick={() => {
                setPendingId(s.id);
                startTransition(async () => {
                  await deleteSoftBlock(s.id);
                  toast.success("Đã xoá khung giờ");
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

type FormType = "commitment" | "soft" | "event";
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
  const editingSoft = editing.kind === "edit-soft" ? editing.data : null;
  const editingEvent = editing.kind === "edit-event" ? editing.data : null;

  // loại form: cố định khi sửa; khi thêm thì chọn được (mặc định theo ngữ cảnh)
  const initialType: FormType =
    editing.kind === "edit-event" || editing.kind === "new-event"
      ? "event"
      : editing.kind === "edit-soft" || editing.kind === "new-soft"
        ? "soft"
        : "commitment";
  const [type, setType] = useState<FormType>(initialType);
  const isEdit =
    editing.kind === "edit-commitment" ||
    editing.kind === "edit-soft" ||
    editing.kind === "edit-event";

  const [title, setTitle] = useState(
    editingCommitment?.title ?? editingSoft?.title ?? editingEvent?.title ?? "",
  );
  const [kind, setKind] = useState<ScheduleKind>(
    editingCommitment?.kind ?? editingSoft?.kind ?? editingEvent?.kind ?? "hoc",
  );
  // commitment + soft (dùng chung các field thứ/giờ)
  const [dayOfWeek, setDayOfWeek] = useState<number>(
    editingCommitment?.dayOfWeek ??
      editingSoft?.dayOfWeek ??
      (editing.kind === "new-commitment" ||
      editing.kind === "new-soft" ||
      editing.kind === "new-from-grid"
        ? editing.dayOfWeek
        : 1),
  );
  const [start, setStart] = useState(
    editingCommitment?.startTime ??
      editingSoft?.startTime ??
      (editing.kind === "new-from-grid" ? editing.start : "08:00"),
  );
  const [end, setEnd] = useState(
    editingCommitment?.endTime ??
      editingSoft?.endTime ??
      (editing.kind === "new-from-grid" ? editing.end : "10:00"),
  );
  // kỳ học (mục 14) — tùy chọn, dùng chung cho commitment & soft
  const [validFrom, setValidFrom] = useState(
    editingCommitment?.validFrom ?? editingSoft?.validFrom ?? "",
  );
  const [validUntil, setValidUntil] = useState(
    editingCommitment?.validUntil ?? editingSoft?.validUntil ?? "",
  );
  const [weekParity, setWeekParity] = useState<string | null>(
    editingCommitment?.weekParity ?? editingSoft?.weekParity ?? null,
  );
  const [showTerm, setShowTerm] = useState(
    !!(validFrom || validUntil || weekParity),
  );
  // event
  const [date, setDate] = useState(
    editingEvent?.date ??
      (editing.kind === "new-event" || editing.kind === "new-from-grid"
        ? editing.date
        : weekStart),
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
  const [evStart, setEvStart] = useState(
    editingEvent?.startTime ??
      (editing.kind === "new-from-grid" ? editing.start : "09:00"),
  );
  const [evEnd, setEvEnd] = useState(
    editingEvent?.endTime ??
      (editing.kind === "new-from-grid" ? editing.end : "11:00"),
  );

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
          validFrom: validFrom || null,
          validUntil: validUntil || null,
          weekParity,
        };
        res = editingCommitment
          ? await updateCommitment(editingCommitment.id, payload)
          : await addCommitment(payload);
      } else if (type === "soft") {
        const payload = {
          title,
          dayOfWeek,
          startTime: start,
          endTime: end,
          kind,
          validFrom: validFrom || null,
          validUntil: validUntil || null,
          weekParity,
        };
        res = editingSoft
          ? await updateSoftBlock(editingSoft.id, payload)
          : await addSoftBlock(payload);
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
      : editing.kind === "edit-soft"
        ? "Sửa khung giờ"
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
          <div className="flex flex-wrap gap-1">
            <SegBtn
              active={type === "commitment"}
              onClick={() => setType("commitment")}
            >
              Lịch cứng
            </SegBtn>
            <SegBtn active={type === "soft"} onClick={() => setType("soft")}>
              <Move className="size-3.5" /> Khung tập trung
            </SegBtn>
            <SegBtn active={type === "event"} onClick={() => setType("event")}>
              Đột xuất
            </SegBtn>
          </div>
        )}

        {/* tên — ẩn khi là "nghỉ cả ngày" (không cần) */}
        {!(type === "event" && eventMode === "off") && (
          <Field
            label={
              type === "commitment"
                ? "Tên lịch"
                : type === "soft"
                  ? "Tên khung giờ"
                  : "Tên sự kiện"
            }
          >
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === "commitment"
                  ? "VD: Toán cao cấp / Ca làm sáng"
                  : type === "soft"
                    ? "VD: Học Spring Boot / Đọc sách"
                    : "VD: Họp nhóm, khám răng…"
              }
              autoFocus
            />
          </Field>
        )}

        {type === "commitment" || type === "soft" ? (
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

            {/* Kỳ học (tùy chọn): khoảng hiệu lực + tuần chẵn/lẻ */}
            {showTerm ? (
              <div className="space-y-3 rounded-md border border-border/70 bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Kỳ học (tùy chọn)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTerm(false);
                      setValidFrom("");
                      setValidUntil("");
                      setWeekParity(null);
                    }}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Bỏ
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <DatePicker
                    value={validFrom || null}
                    onChange={(d) => setValidFrom(d ?? "")}
                    placeholder="Từ ngày"
                    clearable
                    className="flex-1"
                  />
                  <span className="text-muted-foreground">→</span>
                  <DatePicker
                    value={validUntil || null}
                    onChange={(d) => setValidUntil(d ?? "")}
                    placeholder="Đến ngày"
                    clearable
                    className="flex-1"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <SegBtn
                    active={!weekParity}
                    onClick={() => setWeekParity(null)}
                  >
                    Mọi tuần
                  </SegBtn>
                  <SegBtn
                    active={weekParity === "odd"}
                    onClick={() => setWeekParity("odd")}
                  >
                    Tuần lẻ
                  </SegBtn>
                  <SegBtn
                    active={weekParity === "even"}
                    onClick={() => setWeekParity("even")}
                  >
                    Tuần chẵn
                  </SegBtn>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowTerm(true)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                + Giới hạn theo kỳ học / tuần chẵn-lẻ
              </button>
            )}
          </>
        ) : (
          <>
            <Field label="Ngày">
              <DatePicker value={date} onChange={(d) => setDate(d ?? date)} />
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
      <TimePicker
        value={start}
        onChange={onStart}
        className="flex-1"
        ariaLabel="Giờ bắt đầu"
      />
      <span className="text-muted-foreground">→</span>
      <TimePicker
        value={end}
        onChange={onEnd}
        className="flex-1"
        ariaLabel="Giờ kết thúc"
      />
    </div>
  );
}
