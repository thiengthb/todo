import { mcpHandler } from '@/lib/mcp/server';
import { checkMcpAuth } from '@/lib/mcp/auth';

// MCP needs real data on every request + runs in the Node runtime (Prisma, SDK)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

async function handler(req: Request): Promise<Response> {
  const denied = await checkMcpAuth(req);
  if (denied) return denied;
  return mcpHandler(req);
}

export { handler as GET, handler as POST, handler as DELETE };
