import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./lib/security-headers.ts";

const nextConfig: NextConfig = {
  // Keep browser tests from competing with an already-running developer preview.
  distDir: process.env.CRESTVIEW_E2E === "true" ? ".next-e2e" : ".next",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [...SECURITY_HEADERS],
      },
    ];
  },
};

export default nextConfig;
