import { PrismaClient } from "@prisma/client";

// Reuse a single client across hot-reloads / serverless invocations to avoid
// exhausting the connection pool. Prisma reads DATABASE_URL from the schema.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
