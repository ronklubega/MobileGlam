import type { NextConfig } from "next";

const config: NextConfig = {
  // Lets `NEXT_DIST_DIR=.next-build next build` run without clobbering a running `next dev`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  transpilePackages: ["@glamdesk/shared", "@glamdesk/db"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};
export default config;
