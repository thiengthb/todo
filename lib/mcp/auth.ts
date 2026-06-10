/**
 * Bảo vệ endpoint MCP bằng bearer token (mục 15) — theo đúng pattern NOTIFY_SECRET
 * ở app/api/notify/run/route.ts. MCP ghi được vào DB nên BẮT BUỘC có auth.
 * Chưa đặt MCP_AUTH_TOKEN ⇒ endpoint TẮT (trả 403) để không lộ public.
 */
export function checkMcpAuth(req: Request): Response | null {
  const token = process.env.MCP_AUTH_TOKEN;
  if (!token) {
    return Response.json(
      { error: "MCP tắt: chưa đặt MCP_AUTH_TOKEN" },
      { status: 403 },
    );
  }
  const header = req.headers.get("authorization");
  if (header !== `Bearer ${token}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null; // null = hợp lệ, cho đi tiếp
}
