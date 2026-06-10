import { oauthKey, signCode } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

interface AuthParams {
  responseType: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string;
  scope: string;
}

function readParams(sp: URLSearchParams): AuthParams {
  return {
    responseType: sp.get("response_type") ?? "",
    redirectUri: sp.get("redirect_uri") ?? "",
    codeChallenge: sp.get("code_challenge") ?? "",
    codeChallengeMethod: sp.get("code_challenge_method") ?? "",
    state: sp.get("state") ?? "",
    scope: sp.get("scope") ?? "todo",
  };
}

function invalid(p: AuthParams, error: string): Response {
  // có redirect_uri hợp lệ → trả lỗi theo OAuth; không thì 400 thuần
  if (/^https?:\/\//.test(p.redirectUri)) {
    const u = new URL(p.redirectUri);
    u.searchParams.set("error", error);
    if (p.state) u.searchParams.set("state", p.state);
    return Response.redirect(u.toString(), 302);
  }
  return new Response(`OAuth error: ${error}`, { status: 400 });
}

function consentPage(p: AuthParams, err?: string): Response {
  const hidden = Object.entries({
    response_type: p.responseType,
    redirect_uri: p.redirectUri,
    code_challenge: p.codeChallenge,
    code_challenge_method: p.codeChallengeMethod,
    state: p.state,
    scope: p.scope,
  })
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`)
    .join("");
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cho phép kết nối — Smart Todo MCP</title>
<style>
 body{font-family:system-ui,sans-serif;background:#fafafa;color:#111;display:grid;place-items:center;min-height:100vh;margin:0}
 .card{background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:28px;max-width:380px;width:90%}
 h1{font-size:18px;margin:0 0 6px} p{color:#666;font-size:14px;line-height:1.5;margin:0 0 16px}
 label{font-size:13px;font-weight:600;display:block;margin-bottom:6px}
 input[type=password]{width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #ddd;border-radius:8px;font-size:14px}
 button{margin-top:16px;width:100%;padding:10px;border:0;border-radius:8px;background:#111;color:#fff;font-size:14px;font-weight:600;cursor:pointer}
 .err{color:#c0392b;font-size:13px;margin-top:8px}
</style></head><body><div class="card">
<h1>Kết nối Smart Todo</h1>
<p>Một ứng dụng (Claude) xin quyền đọc/ghi dữ liệu todo của bạn. Nhập <strong>MCP token</strong> để xác nhận đây là bạn.</p>
<form method="POST">${hidden}
<label for="secret">MCP token</label>
<input id="secret" name="secret" type="password" autocomplete="off" autofocus required>
${err ? `<p class="err">${esc(err)}</p>` : ""}
<button type="submit">Cho phép</button>
</form></div></body></html>`;
  return new Response(html, {
    status: err ? 401 : 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export function GET(req: Request): Response {
  const p = readParams(new URL(req.url).searchParams);
  if (!process.env.MCP_AUTH_TOKEN || !oauthKey()) {
    return new Response("OAuth chưa bật (thiếu MCP_AUTH_TOKEN)", { status: 403 });
  }
  if (p.responseType !== "code") return invalid(p, "unsupported_response_type");
  if (!p.codeChallenge || p.codeChallengeMethod !== "S256")
    return invalid(p, "invalid_request"); // bắt buộc PKCE S256
  if (!/^https?:\/\//.test(p.redirectUri)) return invalid(p, "invalid_request");
  return consentPage(p);
}

export async function POST(req: Request): Promise<Response> {
  const key = oauthKey();
  const consentToken = process.env.MCP_AUTH_TOKEN;
  if (!consentToken || !key) {
    return new Response("OAuth chưa bật", { status: 403 });
  }
  const form = await req.formData();
  const p: AuthParams = {
    responseType: String(form.get("response_type") ?? ""),
    redirectUri: String(form.get("redirect_uri") ?? ""),
    codeChallenge: String(form.get("code_challenge") ?? ""),
    codeChallengeMethod: String(form.get("code_challenge_method") ?? ""),
    state: String(form.get("state") ?? ""),
    scope: String(form.get("scope") ?? "todo"),
  };
  const secret = String(form.get("secret") ?? "");
  if (secret !== consentToken) {
    return consentPage(p, "MCP token không đúng. Thử lại.");
  }
  if (!/^https?:\/\//.test(p.redirectUri) || !p.codeChallenge) {
    return invalid(p, "invalid_request");
  }
  const code = await signCode(key, {
    codeChallenge: p.codeChallenge,
    redirectUri: p.redirectUri,
  });
  const u = new URL(p.redirectUri);
  u.searchParams.set("code", code);
  if (p.state) u.searchParams.set("state", p.state);
  return Response.redirect(u.toString(), 302);
}
