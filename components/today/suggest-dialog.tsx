"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Plus, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { addTomorrowTask } from "@/app/actions";
import type { Priority, SuggestionItem, SuggestionResult } from "@/lib/types";

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "cao",
  medium: "vừa",
  low: "nhẹ",
};

const PRIORITY_CLASS: Record<Priority, string> = {
  high: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
  medium:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  low: "border-border bg-muted text-muted-foreground",
};

function SuggestionRow({
  item,
  isCarryOver,
}: {
  item: SuggestionItem;
  isCarryOver: boolean;
}) {
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-start gap-3 border-b border-border/70 py-3 last:border-b-0">
      <Badge
        variant="outline"
        className={cn(
          "mt-0.5 shrink-0 text-[11px] font-normal",
          PRIORITY_CLASS[item.priority]
        )}
      >
        {PRIORITY_LABEL[item.priority]}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{item.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.reason}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={added || pending}
        onClick={() =>
          startTransition(async () => {
            await addTomorrowTask(item.title, isCarryOver);
            setAdded(true);
          })
        }
        className="shrink-0"
      >
        {added ? (
          <>
            <Check className="size-3.5" /> Đã thêm
          </>
        ) : pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <>
            <Plus className="size-3.5" /> Ngày mai
          </>
        )}
      </Button>
    </div>
  );
}

export function SuggestDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SuggestionResult | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/suggest", { method: "POST" });
      const data = (await res.json()) as SuggestionResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Lỗi ${res.status}`);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && !result && !loading) void generate();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-center gap-2">
          <Sparkles className="size-4" />
          Đề xuất todo cho ngày mai
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" /> Đề xuất cho ngày mai
          </DialogTitle>
          <DialogDescription>
            Dựa trên việc đã xong, việc còn dở, cảm xúc và tốc độ thực tế của bạn.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="space-y-3 py-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-5/6" />
            <Skeleton className="h-9 w-full" />
          </div>
        )}

        {error && (
          <div className="space-y-3 py-2">
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
            <Button variant="outline" size="sm" onClick={generate}>
              <RefreshCw className="size-3.5" /> Thử lại
            </Button>
          </div>
        )}

        {result && (
          <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
            {/* capacity note */}
            <p className="rounded-md border border-border/70 bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
              {result.capacity_note}
            </p>

            {result.carry_over.length > 0 && (
              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Giữ lại từ hôm trước
                </h3>
                {result.carry_over.map((item, i) => (
                  <SuggestionRow key={`c-${i}`} item={item} isCarryOver />
                ))}
              </section>
            )}

            {result.suggested_tasks.length > 0 && (
              <section>
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Việc mới đề xuất
                </h3>
                {result.suggested_tasks.map((item, i) => (
                  <SuggestionRow key={`s-${i}`} item={item} isCarryOver={false} />
                ))}
              </section>
            )}

            {result.carry_over.length === 0 && result.suggested_tasks.length === 0 && (
              <p className="py-2 text-center text-sm text-muted-foreground">
                Chưa đủ dữ liệu để đề xuất — dùng app thêm vài ngày nhé.
              </p>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={generate}
              className="text-muted-foreground"
            >
              <RefreshCw className="size-3.5" /> Tạo lại đề xuất
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
