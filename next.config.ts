import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build ra .next/standalone để Docker image gọn (chỉ chứa dependency thật sự dùng)
  output: "standalone",
};

export default nextConfig;
