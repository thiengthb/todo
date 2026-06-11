import { getOrigin, oauthKey, verifyJwt } from '@/lib/mcp/oauth';

/**
 * Bảo vệ endpoint MCP (mục 15). Chấp nhận:
 *  - Static bearer = MCP_AUTH_TOKEN (Claude Desktop / Cursor / VS Code).
 *  - OAuth access JWT (Claude.ai web — qua flow /api/oauth/*).
 * 401 kèm `WWW-Authenticate: ... resource_metadata=...` để client tự khởi động OAuth discovery.
 * Chưa đặt token/secret nào ⇒ endpoint TẮT (403).
 */
export async function checkMcpAuth(req: Request): Promise<Response | null> {
  const staticToken = process.env.MCP_AUTH_TOKEN;
  const key = oauthKey();
  if (!staticToken && !key) {
    return Response.json({ error: 'MCP tắt: chưa đặt MCP_AUTH_TOKEN' }, { status: 403 });
  }

  const header = req.headers.get('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (bearer) {
    if (staticToken && bearer === staticToken) return null; // bearer tĩnh
    if (key) {
      const payload = await verifyJwt(key, bearer);
      if (payload?.typ === 'access') return null; // OAuth access token
    }
  }

  const origin = getOrigin(req);
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': `Bearer error="invalid_token", resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
    },
  });
}
