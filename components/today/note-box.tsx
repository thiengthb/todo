"use client";

import { useRef, useState, useTransition } from "react";
import { Textarea } from "@/components/ui/textarea";
import { InfoHint } from "@/components/info-hint";
import { saveNote } from "@/app/actions";

export function NoteBox({ initialNote }: { initialNote: string }) {
  const [note, setNote] = useState(initialNote);
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

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <label
          htmlFor="daily-note"
          className="text-sm font-medium text-foreground"
        >
          Hôm nay của bạn thế nào?
        </label>
        <InfoHint label="Ghi chú để làm gì?">
          Tùy chọn. AI sẽ đọc ghi chú này khi đề xuất việc cho ngày mai — cứ
          viết tự nhiên.
        </InfoHint>
      </div>
      <Textarea
        id="daily-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={persist}
        placeholder="VD: chiều nay hơi đuối vì họp nhiều, nhưng xong được việc khó nhất..."
        rows={3}
        className="resize-none shadow-none"
      />
      <p className="mt-1.5 h-4 text-xs text-muted-foreground">
        {pending
          ? "Đang lưu..."
          : savedAt
            ? "Đã lưu ✓"
            : "Tự lưu khi rời ô nhập"}
      </p>
    </div>
  );
}
