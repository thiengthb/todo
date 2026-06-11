import { createHash } from 'crypto';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

/**
 * OAuth 2.1 shim cho MCP (mục 15) — để Claude.ai web (chỉ hỗ trợ OAuth, không cho nhập bearer)
 * kết nối được. STATELESS: code/access/refresh đều là JWT ký HMAC (không cần bảng DB).
 * Consent gate bằng MCP_AUTH_TOKEN (chủ nhân nhập 1 lần ở trang /api/oauth/authorize).
 * PKCE S256 bắt buộc. Client công khai (token_endpoint_auth_method = none).
 */

/** Khoá ký: MCP_OAUTH_SECRET nếu có, không thì dùng MCP_AUTH_TOKEN. null = OAuth tắt. */
export function oauthKey(): Uint8Array | null {
  const s = process.env.MCP_OAUTH_SECRET || process.env.MCP_AUTH_TOKEN;
  return s ? new TextEncoder().encode(s) : null;
}

/** Origin công khai (sau Traefik/Cloudflare) từ header forwarded; fallback URL request. */
export function getOrigin(req: Request): string {
  const h = req.headers;
  const url = new URL(req.url);
  const proto = h.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? url.host;
  return `${proto}://${host}`;
}

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, mcp-protocol-version',
};

export function jsonCors(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/** Verify code_verifier khớp code_challenge (S256). */
export function verifyPkceS256(verifier: string, challenge: string): boolean {
  const hash = createHash('sha256').update(verifier).digest('base64url');
  return hash === challenge;
}

const SECONDS = { code: 300, access: 3600, refresh: 60 * 60 * 24 * 30 };

async function sign(
  key: Uint8Array,
  typ: 'code' | 'access' | 'refresh',
  extra: JWTPayload,
): Promise<string> {
  return new SignJWT({ typ, ...extra })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setSubject('owner')
    .setExpirationTime(`${SECONDS[typ]}s`)
    .sign(key);
}

/** Code đính kèm PKCE challenge + redirect_uri để verify ở /token. */
export function signCode(
  key: Uint8Array,
  data: { codeChallenge: string; redirectUri: string },
): Promise<string> {
  return sign(key, 'code', { cc: data.codeChallenge, ru: data.redirectUri });
}
export function signAccess(key: Uint8Array): Promise<string> {
  return sign(key, 'access', { scope: 'todo' });
}
export function signRefresh(key: Uint8Array): Promise<string> {
  return sign(key, 'refresh', {});
}

export async function verifyJwt(key: Uint8Array, token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key);
    return payload;
  } catch {
    return null;
  }
}

export const ACCESS_TTL = SECONDS.access;
