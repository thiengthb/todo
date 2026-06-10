import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build ra .next/standalone để Docker image gọn (chỉ chứa dependency thật sự dùng)
  output: "standalone",
  // server-only packages — để ngoài bundle cho an toàn (node-cron mục 13, MCP mục 15)
  serverExternalPackages: ["node-cron", "mcp-handler", "@modelcontextprotocol/sdk"],
  // OAuth discovery (mục 15): Next bỏ qua thư mục dấu chấm → map /.well-known/* sang route metadata
  async rewrites() {
    return [
      {
        source: "/.well-known/oauth-authorization-server",
        destination: "/api/oauth/meta/authorization-server",
      },
      {
        source: "/.well-known/oauth-authorization-server/:path*",
        destination: "/api/oauth/meta/authorization-server",
      },
      {
        source: "/.well-known/oauth-protected-resource",
        destination: "/api/oauth/meta/protected-resource",
      },
      {
        source: "/.well-known/oauth-protected-resource/:path*",
        destination: "/api/oauth/meta/protected-resource",
      },
    ];
  },
};

export default nextConfig;
