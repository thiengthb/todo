import { NextRequest, NextResponse } from "next/server";
import { runNotification } from "@/lib/notify/run";
import type { NotificationKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const KINDS: NotificationKind[] = [
  "morning",
  "streak_guard",
  "random_nudge",
  "evening",
];

/**
 * Endpoint kích hoạt thông báo từ BÊN NGOÀI (mục 13) — fallback cho scheduler nội bộ
 * (Windows Task Scheduler / cron / GitHub Actions). Bảo vệ bằng NOTIFY_SECRET.
 *
 *   POST /api/notify/run?kind=morning&secret=...   (hoặc header x-notify-secret)
 *   ?force=1  → bỏ qua gating/giờ yên/idempotency (gửi thử)
 *
 * Nếu NOTIFY_SECRET chưa đặt → endpoint TẮT (tránh ai cũng spam được).
 */
async function handle(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.NOTIFY_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Endpoint tắt: chưa đặt NOTIFY_SECRET" },
      { status: 403 },
    );
  }
  const provided =
    req.nextUrl.searchParams.get("secret") ??
    req.headers.get("x-notify-secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Sai secret" }, { status: 401 });
  }

  const kindParam = req.nextUrl.searchParams.get("kind");
  const force = req.nextUrl.searchParams.get("force") === "1";

  // không có kind → chạy tất cả loại (để 1 cron ngoài lo hết)
  const kinds = kindParam
    ? KINDS.filter((k) => k === kindParam)
    : KINDS;
  if (kindParam && kinds.length === 0) {
    return NextResponse.json({ error: "kind không hợp lệ" }, { status: 400 });
  }

  const results = [];
  for (const kind of kinds) {
    results.push(await runNotification(kind, { force }));
  }
  return NextResponse.json({ results });
}

export const GET = handle;
export const POST = handle;
