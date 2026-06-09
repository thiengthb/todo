"use client";

import { useState, useTransition } from "react";
import { Check, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDateShort } from "@/lib/dates";
import { addMilestone, deleteMilestone, toggleMilestone } from "@/app/actions";

export interface MilestoneRow {
  id: string;
  title: string;
  order: number;
  targetDate: string | null;
  done: boolean;
}

export function MilestoneList({
  planId,
  milestones,
}: {
  planId: string;
  milestones: MilestoneRow[];
}) {
  const [, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function submitNew() {
    const t = draft.trim();
    if (!t) {
      setAdding(false);
      return;
    }
    setDraft("");
    setAdding(false);
    startTransition(() => addMilestone(planId, t));
  }

  return (
    <div>
      {milestones.map((m) => (
        <div
          key={m.id}
          className="group flex items-center gap-3 border-b border-border/70 py-3 last:border-b-0"
        >
          <button
            type="button"
            aria-label={m.done ? "Bỏ đánh dấu xong" : "Đánh dấu xong cột mốc"}
            onClick={() =>
              startTransition(() => toggleMilestone(m.id, !m.done))
            }
            className={cn(
              "flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors",
              m.done
                ? "border-foreground bg-foreground text-background"
                : "border-muted-foreground/50 hover:border-foreground",
            )}
          >
            {m.done && <Check className="size-3" strokeWidth={3} />}
          </button>

          <span
            className={cn(
              "min-w-0 flex-1 text-sm",
              m.done && "text-muted-foreground line-through",
            )}
          >
            {m.title}
          </span>

          {m.targetDate && (
            <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
              {formatDateShort(m.targetDate)}
            </span>
          )}

          <button
            type="button"
            aria-label="Xoá cột mốc"
            onClick={() => startTransition(() => deleteMilestone(m.id))}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-60 transition-opacity hover:!opacity-100 hover:text-destructive focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-60"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}

      {adding ? (
        <div className="flex items-center gap-3 py-3">
          <span className="size-[18px] shrink-0 rounded-full border border-dashed border-muted-foreground/40" />
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNew();
              if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
            onBlur={submitNew}
            placeholder="Tên cột mốc... (Enter)"
            className="h-8 border-0 border-b bg-transparent text-sm shadow-none rounded-none focus-visible:ring-0"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-1 flex items-center gap-2 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="size-3.5" /> Thêm cột mốc
        </button>
      )}
    </div>
  );
}
