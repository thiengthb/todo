import { NextResponse } from "next/server";

// Cho Docker HEALTHCHECK và CI — không đụng DB, chỉ xác nhận app sống
export function GET(): NextResponse {
  return NextResponse.json({ ok: true });
}
