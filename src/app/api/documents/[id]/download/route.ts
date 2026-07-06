import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { requireSessionApi, UnauthorizedError } from "@/server/auth/require-session";
import { presignDownload } from "@/server/storage/s3";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Auth'd download gate. The S3 bucket is private; access control lives here. We
 * mint a 60-second presigned GET and redirect — the file bytes never stream
 * through the function (no response-size limit, works for 10MB resumes).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSessionApi();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }

  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const url = await presignDownload(doc.s3Key, doc.fileName);
    return NextResponse.redirect(url, 302);
  } catch (e) {
    logger.error("download.failed", { docId: id, error: String(e) });
    return NextResponse.json({ error: "Could not generate download link" }, { status: 500 });
  }
}
