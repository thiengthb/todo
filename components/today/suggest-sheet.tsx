"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  HeartPulse,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  planLink,
}: {
  item: SuggestionItem;
  isCarryOver: boolean;
  planLink?: { planId: string; milestoneId: string | null };
}) {
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-start gap-3 border-b border-border/70 py-3 last:border-b-0">
      <Badge
        variant="outline"
        className={cn(
          "mt-0.5 shrink-0 text-[11px] font-normal",
          PRIORITY_CLASS[item.priority],
        )}
      >
        {PRIORITY_LABEL[item.priority]}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{item.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.reason}</p>
        {item.cue && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="size-3 shrink-0" />
            {item.cue}
          </p>
        )}
        {(item.slotStart || item.estimatedMinutes) && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="size-3 shrink-0" />
            {item.slotStart && `gợi ý lúc ${item.slotStart}`}
            {item.slotStart && item.estimatedMinutes && " · "}
            {item.estimatedMinutes && `~${item.estimatedMinutes}′`}
            {item.deepWork && " · tập trung sâu"}
          </p>
        )}
        {item.subtasks && item.subtasks.length > 0 && (
          <ul className="mt-1.5 space-y-1 border-l border-border/60 pl-3">
            {item.subtasks.map((s, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                · {s}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={added || pending}
        onClick={() =>
          startTransition(async () => {
            await addTomorrowTask(
              item.title,
              isCarryOver,
              planLink,
              item.subtasks,
              item.cue,
              item.priority, // priority đề xuất = tín hiệu 80/20 (mục 11)
              {
                slotStart: item.slotStart ?? null,
                estimatedMinutes: item.estimatedMinutes ?? null,
                deepWork: item.deepWork,
              },
            );
            setAdded(true);
          })
        }
        className="shrink-0 active:scale-[0.97]"
      >
        {added ? (
          <>
            <Check className="size-3.5" /> Đã thêm
          </>
        ) : pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : item.slotStart ? (
          <>
            <Clock className="size-3.5" /> Xếp {item.slotStart}
          </>
        ) : (
          <>
            <Plus className="size-3.5" /> Ngày mai
          </>
        )}
      </Button>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

/**
 * "Đề xuất ngày mai" — Sheet phải rộng (mục giao diện): tham chiếu được list hôm nay,
 * header/footer cố định, danh sách cuộn trong ScrollArea (thanh cuộn đẹp), không cuộn cả modal.
 */
export function SuggestSheet() {
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

  const empty =
    result &&
    result.carry_over.length === 0 &&
    result.suggested_tasks.length === 0 &&
    result.plan_tasks.length === 0;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && !result && !loading) void generate();
      }}
    >
      <SheetTrigger asChild>
        <Button className="w-full gap-2 active:scale-[0.99]">
          <Sparkles className="size-4" />
          Đề xuất todo cho ngày mai
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b border-border/70 px-5 py-4">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4" /> Đề xuất cho ngày mai
          </SheetTitle>
          <SheetDescription>
            Dựa trên việc đã xong, việc còn dở, cảm xúc và tốc độ thực tế của
            bạn.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-5 px-5 py-4">
            {loading && (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-5/6" />
                <Skeleton className="h-9 w-full" />
              </div>
            )}

            {error && (
              <div className="space-y-3">
                <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {error}
                </p>
                <Button variant="outline" size="sm" onClick={generate}>
                  <RefreshCw className="size-3.5" /> Thử lại
                </Button>
              </div>
            )}

            {result && (
              <>
                {result.recovery_day && (
                  <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
                    <HeartPulse className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs leading-relaxed text-emerald-700 dark:text-emerald-400">
                      Hôm nay nên là <strong>ngày phục hồi</strong> — sức đang
                      thấp, chỉ làm vài việc thật nhẹ để giữ nhịp. Nghỉ ngơi
                      cũng là một phần của kỷ luật.
                    </p>
                  </div>
                )}

                <p className="rounded-md border border-border/70 bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                  {result.capacity_note}
                </p>

                {result.plan_alerts.map((a) => (
                  <div
                    key={a.planId}
                    className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40"
                  >
                    <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      {a.planTitle} đang chậm ~{a.behindDays} ngày
                    </p>
                    <p className="mt-1 text-[11px] text-amber-700/80 dark:text-amber-400/80">
                      Mở trang kế hoạch để giãn deadline, bỏ bớt cột mốc, hoặc
                      tăng tốc.
                    </p>
                  </div>
                ))}

                {result.carry_over.length > 0 && (
                  <section>
                    <SectionTitle>Giữ lại từ hôm trước</SectionTitle>
                    {result.carry_over.map((item, i) => (
                      <SuggestionRow key={`c-${i}`} item={item} isCarryOver />
                    ))}
                  </section>
                )}

                {result.suggested_tasks.length > 0 && (
                  <section>
                    <SectionTitle>Việc mới đề xuất</SectionTitle>
                    {result.suggested_tasks.map((item, i) => (
                      <SuggestionRow
                        key={`s-${i}`}
                        item={item}
                        isCarryOver={false}
                      />
                    ))}
                  </section>
                )}

                {result.plan_tasks.length > 0 && (
                  <section>
                    <SectionTitle>
                      <Target className="size-3" /> Theo kế hoạch
                    </SectionTitle>
                    {result.plan_tasks.map((item, i) => (
                      <SuggestionRow
                        key={`p-${i}`}
                        item={item}
                        isCarryOver={false}
                        planLink={{
                          planId: item.planId,
                          milestoneId: item.milestoneId,
                        }}
                      />
                    ))}
                  </section>
                )}

                {empty && (
                  <p className="py-2 text-center text-sm text-muted-foreground">
                    Chưa đủ dữ liệu để đề xuất — dùng app thêm vài ngày nhé.
                  </p>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {result && (
          <div className="border-t border-border/70 px-5 py-3">
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
      </SheetContent>
    </Sheet>
  );
}
