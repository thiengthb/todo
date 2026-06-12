import { NextResponse } from 'next/server';

// For Docker HEALTHCHECK and CI — does not touch the DB, just confirms the app is alive
export function GET(): NextResponse {
  return NextResponse.json({ ok: true });
}
