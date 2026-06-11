'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Send, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { TimePicker } from '@/components/ui/time-picker';
import { InfoHint } from '@/components/info-hint';
import { IconTooltip } from '@/components/icon-tooltip';
import { cn } from '@/lib/utils';
import { saveNotificationSettings, sendTestNotification } from '@/app/notifications/actions';
import type { NotificationIntensity, NotificationKind, NotificationSettingsDTO } from '@/lib/types';

const INTENSITY_PRESETS: Record<
  NotificationIntensity,
  Pick<
    NotificationSettingsDTO,
    'morningEnabled' | 'streakGuardEnabled' | 'randomNudgeEnabled' | 'eveningEnabled'
  >
> = {
  minimal: {
    morningEnabled: false,
    streakGuardEnabled: true,
    randomNudgeEnabled: false,
    eveningEnabled: false,
  },
  balanced: {
    morningEnabled: true,
    streakGuardEnabled: true,
    randomNudgeEnabled: true,
    eveningEnabled: false,
  },
  active: {
    morningEnabled: true,
    streakGuardEnabled: true,
    randomNudgeEnabled: true,
    eveningEnabled: true,
  },
};

const INTENSITY_META: {
  key: NotificationIntensity;
  label: string;
  hint: string;
}[] = [
  {
    key: 'minimal',
    label: 'Tối thiểu',
    hint: 'Gần như im lặng — chỉ nhắc giữ chuỗi khi thật sự nguy hiểm.',
  },
  {
    key: 'balanced',
    label: 'Vừa phải',
    hint: 'Bản tin sáng + nhắc streak + 1 cú hích/ngày. Khuyên dùng.',
  },
  {
    key: 'active',
    label: 'Năng động',
    hint: 'Thêm đúc kết tối. Vẫn có giờ yên + trần tần suất để không spam.',
  },
];

export function NotificationSettingsForm({ initial }: { initial: NotificationSettingsDTO }) {
  const [s, setS] = useState<NotificationSettingsDTO>(initial);
  const [saving, startSave] = useTransition();
  const [testing, setTesting] = useState<NotificationKind | null>(null);

  const set = <K extends keyof NotificationSettingsDTO>(
    key: K,
    value: NotificationSettingsDTO[K],
  ) => setS((prev) => ({ ...prev, [key]: value }));

  function applyIntensity(intensity: NotificationIntensity) {
    setS((prev) => ({ ...prev, intensity, ...INTENSITY_PRESETS[intensity] }));
  }

  function save() {
    startSave(async () => {
      const res = await saveNotificationSettings(s);
      if (res.ok) toast.success('Đã lưu cấu hình thông báo');
      else toast.error(res.error ?? 'Lưu thất bại');
    });
  }

  // Gửi thử: lưu trạng thái hiện tại trước (để dùng webhook mới nhất), rồi bắn
  async function test(kind: NotificationKind) {
    setTesting(kind);
    try {
      const saved = await saveNotificationSettings(s);
      if (!saved.ok) {
        toast.error(saved.error ?? 'Cần lưu cấu hình trước');
        return;
      }
      const res = await sendTestNotification(kind);
      if (res.status === 'sent') toast.success('Đã gửi thử lên Discord ✓');
      else if (res.status === 'error') toast.error(`Gửi thất bại: ${res.detail}`);
      else toast.message(`Bỏ qua: ${res.detail}`);
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="space-y-10">
      {/* ───── Kênh + công tắc tổng ───── */}
      <section className="space-y-4 rounded-lg border border-border/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Bật thông báo Discord</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Công tắc tổng — tắt là dừng mọi thông báo theo lịch.
            </p>
          </div>
          <Switch checked={s.enabled} onCheckedChange={(v) => set('enabled', v)} />
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-1.5">
            <label htmlFor="webhook" className="text-sm font-medium">
              Webhook URL
            </label>
            <InfoHint label="Lấy webhook ở đâu?">
              Trong Discord: chọn kênh → ⚙ Chỉnh sửa kênh → Tích hợp → Webhook → Webhook mới → Sao
              chép URL. Dán vào đây.
            </InfoHint>
          </div>
          <div className="flex gap-2">
            <Input
              id="webhook"
              type="url"
              placeholder="https://discord.com/api/webhooks/..."
              value={s.discordWebhookUrl}
              onChange={(e) => set('discordWebhookUrl', e.target.value)}
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => test('morning')}
              disabled={testing !== null}
            >
              {testing === 'morning' ? <Loader2 className="animate-spin" /> : <Send />}
              Gửi thử
            </Button>
          </div>
        </div>
      </section>

      {/* ───── Cường độ ───── */}
      <section className="space-y-3">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-medium">Cường độ thông báo</h2>
          <InfoHint label="Cường độ là gì?">
            Đặt nhanh tổ hợp loại thông báo. Bạn vẫn chỉnh từng loại bên dưới sau khi chọn.
          </InfoHint>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {INTENSITY_META.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => applyIntensity(it.key)}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                s.intensity === it.key
                  ? 'border-foreground bg-muted'
                  : 'border-border/70 hover:border-foreground/40',
              )}
            >
              <span className="text-sm font-medium">{it.label}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {it.hint}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ───── Từng loại ───── */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Loại thông báo</h2>
        <div className="rounded-lg border border-border/70">
          <KindRow
            title="☀️ Bản tin sáng"
            hint="Đầu ngày: việc hôm nay, trạng thái streak, việc chính + 1 câu động lực/quote/tip do AI viết."
            enabled={s.morningEnabled}
            onToggle={(v) => set('morningEnabled', v)}
            time={s.morningTime}
            onTime={(v) => set('morningTime', v)}
            onTest={() => test('morning')}
            testing={testing === 'morning'}
            disabledTest={testing !== null}
          />
          <KindRow
            title="🌱 Nhắc giữ streak"
            hint="Chỉ bắn khi chuỗi đang nguy hiểm và hôm nay chưa làm việc nào. Giọng dịu, không doạ."
            enabled={s.streakGuardEnabled}
            onToggle={(v) => set('streakGuardEnabled', v)}
            time={s.streakGuardTime}
            onTime={(v) => set('streakGuardTime', v)}
            onTest={() => test('streak_guard')}
            testing={testing === 'streak_guard'}
            disabledTest={testing !== null}
          />
          <KindRow
            title="👋 Cú hích ngẫu nhiên"
            hint="Tối đa 1 lần/ngày, vào một thời điểm ngẫu nhiên trong cửa sổ dưới đây. Bỏ qua nếu không còn việc dở."
            enabled={s.randomNudgeEnabled}
            onToggle={(v) => set('randomNudgeEnabled', v)}
            onTest={() => test('random_nudge')}
            testing={testing === 'random_nudge'}
            disabledTest={testing !== null}
            window={{
              start: s.randomWindowStart,
              end: s.randomWindowEnd,
              onStart: (v) => set('randomWindowStart', v),
              onEnd: (v) => set('randomWindowEnd', v),
            }}
          />
          <KindRow
            title="🌙 Đúc kết tối"
            hint="Cuối ngày: điểm lại việc đã làm, giọng tử tế, gợi ý ghi chú. Không phán xét phần chưa xong."
            enabled={s.eveningEnabled}
            onToggle={(v) => set('eveningEnabled', v)}
            time={s.eveningTime}
            onTime={(v) => set('eveningTime', v)}
            onTest={() => test('evening')}
            testing={testing === 'evening'}
            disabledTest={testing !== null}
            last
          />
        </div>
      </section>

      {/* ───── Giờ yên ───── */}
      <section className="space-y-3">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-medium">Giờ yên</h2>
          <InfoHint label="Giờ yên là gì?">
            Trong khoảng này app không gửi bất kỳ thông báo nào (kể cả tới giờ đã đặt). Có thể vắt
            qua nửa đêm, vd 22:00 → 07:00.
          </InfoHint>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border/70 p-4">
          <TimeField label="Từ" value={s.quietStart} onChange={(v) => set('quietStart', v)} />
          <TimeField label="Đến" value={s.quietEnd} onChange={(v) => set('quietEnd', v)} />
        </div>
      </section>

      {/* ───── Nội dung AI ───── */}
      <section className="space-y-3">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-medium">Nội dung do AI viết</h2>
          <InfoHint label="AI viết gì?">
            Số liệu (streak, số việc, việc chính) luôn do hệ thống tính thật. AI chỉ thêm phần giọng
            văn: động lực, câu nói hay, mẹo. Tắt phần nào thì bỏ phần đó.
          </InfoHint>
        </div>
        <div className="rounded-lg border border-border/70">
          <ToggleRow
            label="Lời động lực"
            enabled={s.includeMotivation}
            onToggle={(v) => set('includeMotivation', v)}
          />
          <ToggleRow
            label="Câu nói hay / danh ngôn"
            enabled={s.includeQuote}
            onToggle={(v) => set('includeQuote', v)}
          />
          <ToggleRow
            label="Mẹo năng suất / thói quen"
            enabled={s.includeTip}
            onToggle={(v) => set('includeTip', v)}
            last
          />
        </div>
      </section>

      {/* ───── Lưu ───── */}
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-10 -mx-1 flex justify-end lg:bottom-4">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-sm">
          {saving && <Loader2 className="animate-spin" />}
          Lưu cấu hình
        </Button>
      </div>
    </div>
  );
}

/* ───────── mảnh con ───────── */

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <TimePicker value={value} onChange={onChange} className="w-28" ariaLabel={label} />
    </label>
  );
}

function KindRow({
  title,
  hint,
  enabled,
  onToggle,
  time,
  onTime,
  window,
  onTest,
  testing,
  disabledTest,
  last,
}: {
  title: string;
  hint: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  time?: string;
  onTime?: (v: string) => void;
  window?: {
    start: string;
    end: string;
    onStart: (v: string) => void;
    onEnd: (v: string) => void;
  };
  onTest: () => void;
  testing: boolean;
  disabledTest: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3',
        !last && 'border-b border-border/70',
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-1.5">
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {time !== undefined && onTime && (
          <TimePicker
            value={time}
            onChange={onTime}
            className="w-28"
            disabled={!enabled}
            ariaLabel="Giờ gửi"
          />
        )}
        {window && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TimePicker
              value={window.start}
              onChange={window.onStart}
              className="w-24"
              disabled={!enabled}
              ariaLabel="Từ giờ"
            />
            <span>→</span>
            <TimePicker
              value={window.end}
              onChange={window.onEnd}
              className="w-24"
              disabled={!enabled}
              ariaLabel="Đến giờ"
            />
          </div>
        )}
        <IconTooltip label="Gửi thử">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onTest}
            disabled={disabledTest}
            aria-label="Gửi thử loại này"
          >
            {testing ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </IconTooltip>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  enabled,
  onToggle,
  last,
}: {
  label: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3',
        !last && 'border-b border-border/70',
      )}
    >
      <span className="text-sm">{label}</span>
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </div>
  );
}
