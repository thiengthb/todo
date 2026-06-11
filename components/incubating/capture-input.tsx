'use client';

import { useState, useTransition } from 'react';
import { Sprout } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { addGoal } from '@/app/incubating/actions';

/**
 * Bắt giữ mục tiêu 1 chạm (mục 17): chỉ cần tiêu đề + Enter. Ghi chú/cỡ để sau — giữ ma sát thấp (§11).
 */
export function CaptureInput() {
  const [title, setTitle] = useState('');
  const [pending, startTransition] = useTransition();

  function submit() {
    const t = title.trim();
    if (!t || pending) return;
    setTitle('');
    startTransition(() => addGoal(t));
  }

  return (
    <div className="relative">
      <Sprout className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        placeholder="Ấp ủ điều gì? Trút ra đây cho nhẹ đầu... (Enter)"
        aria-label="Bắt giữ mục tiêu mới"
        className="rounded-none border-0 border-b border-border/70 bg-transparent pl-9 shadow-none focus-visible:border-foreground/40 focus-visible:ring-0"
      />
    </div>
  );
}
