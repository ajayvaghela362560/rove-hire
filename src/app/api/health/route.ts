import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness + DB reachability. Hit by the keep-warm cron every ~6h so Neon's
 * scale-to-zero instance is already awake when evaluators open the app.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", ts: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
}
