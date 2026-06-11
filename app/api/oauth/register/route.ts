import { randomUUID } from 'crypto';
import { jsonCors, CORS_HEADERS } from '@/lib/mcp/oauth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// RFC 7591 — Dynamic Client Registration. Client công khai + PKCE nên KHÔNG cần lưu/secret:
// chỉ cấp client_id và phản hồi metadata client gửi lên (echo redirect_uris).
export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* body rỗng cũng được */
  }
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
  return jsonCors(
    {
      client_id: randomUUID(),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    },
    201,
  );
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
