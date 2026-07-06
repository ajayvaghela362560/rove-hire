import { NextRequest, NextResponse } from "next/server";
import { presignSchema } from "@/lib/validation/schemas";
import { requireSessionApi, UnauthorizedError } from "@/server/auth/require-session";
import { newResumeKey, presignResumeUpload } from "@/server/storage/s3";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await requireSessionApi();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }

  const body = await req.json().catch(() => null);
  const parsed = presignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const key = newResumeKey();
  try {
    const presigned = await presignResumeUpload(key);
    return NextResponse.json({ key, ...presigned });
  } catch (e) {
    logger.error("presign.failed", { error: String(e) });
    return NextResponse.json({ error: "Could not prepare upload" }, { status: 500 });
  }
}
