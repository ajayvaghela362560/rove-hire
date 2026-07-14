import type { NextConfig } from "next";

// Security headers applied to every response. Kept intentionally conservative so
// nothing in the app breaks: no Content-Security-Policy is set here because Next's
// inline runtime styles/scripts need a nonced CSP to avoid breakage — that is a
// documented follow-up, not shipped half-configured.
const securityHeaders = [
  // Defence-in-depth against MIME sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // This app is never meant to be framed; block clickjacking.
  { key: "X-Frame-Options", value: "DENY" },
  // Don't leak internal paths (candidate IDs, tokens) to third parties via Referer.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No use of these powerful features — deny them outright.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  // Force HTTPS for two years incl. subdomains (safe: only ever served over TLS).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Internal tool with PII — belt-and-suspenders alongside robots.ts / metadata.
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework/server version.
  poweredByHeader: false,
  // @react-pdf/renderer must run as a real Node module, not be bundled by the
  // Next.js server compiler — bundling breaks its font/stream handling.
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    serverActions: {
      // Resumes are uploaded browser -> S3 directly, so action payloads stay tiny.
      // This cap only guards the small JSON/form payloads that hit server actions.
      bodySizeLimit: "1mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
