import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./lib/security-headers.ts";

const nextConfig: NextConfig = {
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
