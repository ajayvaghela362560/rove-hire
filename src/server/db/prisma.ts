import { PrismaClient } from "@prisma/client";

// Reuse a single client across hot-reloads / serverless invocations to avoid
// exhausting the connection pool. Prisma reads DATABASE_URL from the schema.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * On serverless (Vercel) many function instances run concurrently, each with its
 * own Prisma engine and connection pool. When DATABASE_URL points directly at a
 * Postgres server (no external pooler), those pools quickly exhaust the server's
 * connection slots — the "too many clients"/"remaining connection slots" errors.
 *
 * Two mitigations are needed and this handles the second:
 *   1. Route DATABASE_URL through a real pooler (PgBouncer / Prisma Accelerate).
 *   2. Cap EACH instance to a tiny pool so total connections stay bounded.
 *
 * Here we default `connection_limit` to 1 on Vercel unless the URL already sets
 * it, so a misconfigured deploy degrades gracefully instead of melting the DB.
 */
function resolveDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || !process.env.VERCEL) return url;

  try {
    const parsed = new URL(url);
    // Only tune direct Postgres URLs — leave prisma:// (Accelerate) untouched.
    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
      return url;
    }
    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", "1");
    }
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", "15");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: resolveDatabaseUrl(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
