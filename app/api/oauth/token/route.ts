import {
  oauthKey,
  signAccess,
  signRefresh,
  verifyJwt,
  verifyPkceS256,
  jsonCors,
  CORS_HEADERS,
  ACCESS_TTL,
} from '@/lib/mcp/oauth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function err(error: string, status = 400): Response {
  return jsonCors({ error }, status);
}

export async function POST(req: Request): Promise<Response> {
  const key = oauthKey();
  if (!key) return err('invalid_request', 403);

  const form = await req.formData();
  const grantType = String(form.get('grant_type') ?? '');

  if (grantType === 'authorization_code') {
    const code = String(form.get('code') ?? '');
    const verifier = String(form.get('code_verifier') ?? '');
    const redirectUri = String(form.get('redirect_uri') ?? '');
    const payload = await verifyJwt(key, code);
    if (!payload || payload.typ !== 'code') return err('invalid_grant');
    if (payload.ru !== redirectUri) return err('invalid_grant');
    if (typeof payload.cc !== 'string' || !verifyPkceS256(verifier, payload.cc)) {
      return err('invalid_grant'); // PKCE mismatch
    }
    return jsonCors({
      access_token: await signAccess(key),
      token_type: 'Bearer',
      expires_in: ACCESS_TTL,
      refresh_token: await signRefresh(key),
      scope: 'todo',
    });
  }

  if (grantType === 'refresh_token') {
    const rt = String(form.get('refresh_token') ?? '');
    const payload = await verifyJwt(key, rt);
    if (!payload || payload.typ !== 'refresh') return err('invalid_grant');
    return jsonCors({
      access_token: await signAccess(key),
      token_type: 'Bearer',
      expires_in: ACCESS_TTL,
      refresh_token: await signRefresh(key),
      scope: 'todo',
    });
  }

  return err('unsupported_grant_type');
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
