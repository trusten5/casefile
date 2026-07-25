import type { NextConfig } from "next";

// ponytail: no CSP here — Clerk's widget needs its own script/frame/connect
// allowances, and getting that wrong silently breaks sign-in. Add one only
// with time to test the auth flow against it; these are the headers that
// carry no such risk.
const nextConfig: NextConfig = {
  images: {
    // Every company logo_url comes from exactly this one host (see
    // src/lib/scrapers/sync.ts) — not "many hosts", despite what
    // CompanyLogo.tsx's old eslint-disable comment claimed.
    remotePatterns: [{ protocol: "https", hostname: "icons.duckduckgo.com" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
