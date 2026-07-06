import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
