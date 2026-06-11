/**
 * Next.js instrumentation (mục 13): chạy MỘT lần khi server khởi động.
 * Chỉ trong runtime Node.js (không phải Edge) — khởi động scheduler thông báo.
 * Vì bản deploy chạy server always-on (Docker), cron sống cùng app, không cần dịch vụ ngoài.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // không khởi động cron trong lúc `next build`
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  const { startScheduler } = await import('@/lib/notify/scheduler');
  startScheduler();
}
