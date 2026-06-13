'use client';

import { useRef, useState, useTransition } from 'react';
import { PenLine } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { InfoHint } from '@/components/info-hint';
import { saveNote } from '@/app/actions';

/**
 * End-of-day note (UI section, 2026-06 overhaul) — progressive disclosure: when there's no note
 * it shows just one line "+ Today's note", clicking opens the Textarea → keeps the Today page shorter.
 */
export function NoteBox({ initialNote }: { initialNote: string }) {
  const [note, setNote] = useState(initialNote);
  const [open, setOpen] = useState(initialNote.trim() !== '');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const lastSaved = useRef(initialNote);

  function persist() {
    if (note.trim() === lastSaved.current.trim()) return;
    lastSaved.current = note;
    startTransition(async () => {
      await saveNote(note);
      setSavedAt(Date.now());
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border/70 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
      >
        <PenLine className="size-4 shrink-0" />
        Viết ghi chú hôm nay
      </button>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <label htmlFor="daily-note" className="text-sm font-medium text-foreground">
          Hôm nay của bạn thế nào?
        </label>
        <InfoHint label="Ghi chú để làm gì?">
          Tùy chọn. AI sẽ đọc ghi chú này khi đề xuất việc cho ngày mai — cứ viết tự nhiên.
        </InfoHint>
      </div>
      <Textarea
        id="daily-note"
        value={note}
        autoFocus={initialNote.trim() === ''}
        onChange={(e) => {
          setNote(e.target.value);
          if (savedAt) setSavedAt(null); // editing again → drop the stale "Đã lưu ✓"
        }}
        onBlur={persist}
        placeholder="VD: chiều nay hơi đuối vì họp nhiều, nhưng xong được việc khó nhất..."
        rows={3}
        className="resize-none border-border/70 shadow-none"
      />
      <p className="mt-1.5 h-4 text-xs text-muted-foreground">
        {pending ? 'Đang lưu...' : savedAt ? 'Đã lưu ✓' : 'Tự lưu khi rời ô nhập'}
      </p>
    </div>
  );
}
