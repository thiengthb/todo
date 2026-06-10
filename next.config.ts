import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build ra .next/standalone để Docker image gọn (chỉ chứa dependency thật sự dùng)
  output: "standalone",
  // node-cron chạy ở server (instrumentation, mục 13) — để ngoài bundle cho an toàn
  serverExternalPackages: ["node-cron"],
};

export default nextConfig;
