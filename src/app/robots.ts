import type { MetadataRoute } from "next";

/**
 * ROVE Hire is an internal-only tool exposing candidate PII. It must never be
 * crawled or indexed, so disallow every user-agent across the whole site.
 * This is advisory (well-behaved bots only) — it is backed by the
 * `X-Robots-Tag: noindex, nofollow` response header (next.config.ts) and the
 * `robots` metadata in the root layout, which browsers/crawlers honour directly.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
