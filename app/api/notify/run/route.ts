import { NextRequest, NextResponse } from 'next/server';
import { runNotification } from '@/lib/notify/run';
import type { NotificationKind } from '@/lib/types';

export const dynamic = 'force-dynamic';

const KINDS: NotificationKind[] = ['morning', 'streak_guard', 'random_nudge', 'evening'];

/**
 * Endpoint to trigger notifications from the OUTSIDE (section 13) — a fallback for the internal scheduler
 * (Windows Task Scheduler / cron / GitHub Actions). Protected by NOTIFY_SECRET.
 *
 *   POST /api/notify/run?kind=morning&secret=...   (or the x-notify-secret header)
 *   ?force=1  → bypass gating/quiet-hours/idempotency (test send)
 *
 * If NOTIFY_SECRET is not set → the endpoint is OFF (prevents anyone from spamming it).
 */
async function handle(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.NOTIFY_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Endpoint tắt: chưa đặt NOTIFY_SECRET' }, { status: 403 });
  }
  const provided = req.nextUrl.searchParams.get('secret') ?? req.headers.get('x-notify-secret');
  if (provided !== secret) {
    return NextResponse.json({ error: 'Sai secret' }, { status: 401 });
  }

  const kindParam = req.nextUrl.searchParams.get('kind');
  const force = req.nextUrl.searchParams.get('force') === '1';

  // no kind → run all kinds (so a single external cron handles everything)
  const kinds = kindParam ? KINDS.filter((k) => k === kindParam) : KINDS;
  if (kindParam && kinds.length === 0) {
    return NextResponse.json({ error: 'kind không hợp lệ' }, { status: 400 });
  }

  const results = [];
  for (const kind of kinds) {
    results.push(await runNotification(kind, { force }));
  }
  return NextResponse.json({ results });
}

export const GET = handle;
export const POST = handle;
