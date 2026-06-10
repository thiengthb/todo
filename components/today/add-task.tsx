"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { addTask } from "@/app/actions";

export function AddTask({
  date,
  isToday,
  hardTopics = [],
}: {
  date: string;
  isToday: boolean;
  /** chủ đề hay bị chấm "hard" (lib/difficulty.ts) — để gợi ý chia nhỏ khi gõ trúng */
  hardTopics?: string[];
}) {
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const t = title.trim();
    if (!t || pending) return;
    setTitle("");
    startTransition(() => addTask(t, date));
  }

  // chủ đề "hay mệt" khớp trong tiêu đề đang gõ → gợi ý hạ rào (mục 11), không chặn
  const lower = title.toLowerCase();
  const matched =
    title.trim().length >= 3
      ? hardTopics.find((w) => lower.includes(w))
      : undefined;

  return (
    <div>
      <div className="relative">
        <Plus className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={
            isToday
              ? "Thêm việc cho hôm nay... (Enter)"
              : "Lên kế hoạch cho ngày này... (Enter)"
          }
          aria-label="Thêm việc mới"
          className="border-0 border-b border-border/70 bg-transparent pl-9 shadow-none rounded-none focus-visible:ring-0 focus-visible:border-foreground/40"
        />
      </div>
      {matched && (
        <p className="mt-1.5 pl-9 text-[11px] leading-relaxed text-muted-foreground">
          Chủ đề “{matched}” gần đây hay làm bạn mệt — cân nhắc chia thành bước
          nhỏ hơn cho dễ xong.
        </p>
      )}
    </div>
  );
}
