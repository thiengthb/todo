import { Bell } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { NotificationSettingsForm } from "@/components/notifications/settings-form";
import { getSettings } from "@/lib/notify/settings";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  morning: "Bản tin sáng",
  streak_guard: "Nhắc giữ streak",
  random_nudge: "Cú hích ngẫu nhiên",
  evening: "Đúc kết tối",
};

const STATUS_STYLE: Record<string, string> = {
  sent: "text-emerald-600 dark:text-emerald-400",
  skipped: "text-muted-foreground",
  error: "text-rose-600 dark:text-rose-400",
};

const STATUS_LABEL: Record<string, string> = {
  sent: "Đã gửi",
  skipped: "Bỏ qua",
  error: "Lỗi",
};

export default async function NotificationsPage() {
  const [settings, logs] = await Promise.all([
    getSettings(),
    prisma.notificationLog.findMany({
      orderBy: { sentAt: "desc" },
      take: 15,
    }),
  ]);

  return (
    <div className="py-8">
      <PageHeader
        eyebrow="Cài đặt"
        title="Thông báo Discord"
        description="Bản tin sáng, nhắc giữ streak, cú hích làm việc và đúc kết tối — AI viết giọng văn quanh dữ liệu thật của bạn. Giữ nhẹ nhàng, không hối thúc (theo nguyên tắc bền vững của app)."
      />

      <NotificationSettingsForm initial={settings} />

      {/* Lịch sử gửi gần đây */}
      <section className="mt-10 space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">Lịch sử gần đây</h2>
        </div>
        {logs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
            Chưa có thông báo nào được gửi.
          </p>
        ) : (
          <div className="rounded-lg border border-border/70">
            {logs.map((log, i) => (
              <div
                key={log.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3",
                  i < logs.length - 1 && "border-b border-border/70",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {KIND_LABEL[log.kind] ?? log.kind}
                  </p>
                  {log.detail && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {log.detail}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      "text-xs font-medium",
                      STATUS_STYLE[log.status] ?? "text-muted-foreground",
                    )}
                  >
                    {STATUS_LABEL[log.status] ?? log.status}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                    {fmtTime(log.sentAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function fmtTime(d: Date): string {
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
