import { Bell } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { NotificationSettingsForm } from "@/components/notifications/settings-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
        info="Bản tin sáng, nhắc giữ streak, cú hích làm việc và đúc kết tối — AI viết giọng văn quanh dữ liệu thật của bạn. Giữ nhẹ nhàng, không hối thúc (theo nguyên tắc bền vững của app)."
      />

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">Cài đặt</TabsTrigger>
          <TabsTrigger value="history">Lịch sử</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-6">
          <NotificationSettingsForm initial={settings} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {logs.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="Chưa có thông báo nào được gửi"
              description="Bật webhook và một loại thông báo ở tab Cài đặt — lịch sử gửi sẽ hiện ở đây."
              className="py-10"
            />
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
        </TabsContent>
      </Tabs>
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
