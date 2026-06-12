import { NextResponse } from 'next/server';
import { decomposePlan, type DecomposeInput } from '@/lib/ai';
import { daysBetween, isValidDateStr } from '@/lib/dates';
import type { Intensity } from '@/lib/types';

export const dynamic = 'force-dynamic';

const INTENSITIES: readonly Intensity[] = ['nhẹ', 'vừa', 'dồn'];

/** Decompose a goal → roadmap milestones (section 10.7). Does not save to the DB — returns a draft for preview only. */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = (await req.json()) as Partial<{
      title: string;
      goal: string;
      startDate: string;
      endDate: string;
      intensity: string;
    }>;

    const title = body.title?.trim();
    const goal = body.goal?.trim();
    const { startDate, endDate } = body;

    if (!title) return bad('Thiếu tiêu đề kế hoạch');
    if (!goal) return bad('Thiếu mục tiêu kế hoạch');
    if (!startDate || !isValidDateStr(startDate)) return bad('Ngày bắt đầu không hợp lệ');
    if (!endDate || !isValidDateStr(endDate)) return bad('Ngày kết thúc không hợp lệ');

    const durationDays = daysBetween(startDate, endDate);
    if (durationDays < 1) return bad('Ngày kết thúc phải sau ngày bắt đầu');

    const intensity: Intensity = INTENSITIES.includes(body.intensity as Intensity)
      ? (body.intensity as Intensity)
      : 'vừa';

    const input: DecomposeInput = {
      title,
      goal,
      startDate,
      endDate,
      durationDays,
      intensity,
    };

    const result = await decomposePlan(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function bad(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}
