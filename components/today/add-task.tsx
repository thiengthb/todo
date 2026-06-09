"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { addTask } from "@/app/actions";

export function AddTask({ date, isToday }: { date: string; isToday: boolean }) {
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const t = title.trim();
    if (!t || pending) return;
    setTitle("");
    startTransition(() => addTask(t, date));
  }

  return (
    <div className="relative">
      <Plus className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder={isToday ? "Thêm việc cho hôm nay... (Enter)" : "Lên kế hoạch cho ngày này... (Enter)"}
        aria-label="Thêm việc mới"
        className="border-0 border-b border-border/70 bg-transparent pl-9 shadow-none rounded-none focus-visible:ring-0 focus-visible:border-foreground/40"
      />
    </div>
  );
}
