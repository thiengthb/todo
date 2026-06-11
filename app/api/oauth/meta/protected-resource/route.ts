import { getOrigin, jsonCors, CORS_HEADERS } from '@/lib/mcp/oauth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// RFC 9728 — Protected Resource Metadata: chỉ ra Authorization Server cho /api/mcp
export function GET(req: Request): Response {
  const o = getOrigin(req);
  return jsonCors({
    resource: `${o}/api/mcp`,
    authorization_servers: [o],
    bearer_methods_supported: ['header'],
  });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
