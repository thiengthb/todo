import Link from "next/link";
import { LayoutList, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Chuyển giữa Danh sách ⇄ Dòng giờ (mục 14) — giữ qua ?view (theo pattern ?date). */
export function ViewToggle({
  date,
  current,
}: {
  date: string;
  current: "list" | "timeline";
}) {
  const items: {
    value: "list" | "timeline";
    label: string;
    icon: typeof Clock;
  }[] = [
    { value: "list", label: "Danh sách", icon: LayoutList },
    { value: "timeline", label: "Dòng giờ", icon: Clock },
  ];
  return (
    <div className="mb-3 inline-flex rounded-lg border border-border/70 p-0.5">
      {items.map((it) => {
        const active = current === it.value;
        return (
          <Link
            key={it.value}
            href={`/?date=${date}&view=${it.value}`}
            scroll={false}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <it.icon className="size-3.5" />
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
