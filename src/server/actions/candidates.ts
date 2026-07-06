"use server";

import { revalidatePath } from "next/cache";
import { Prisma, TimelineEventType, Actor } from "@prisma/client";
import { createCandidateSchema } from "@/lib/validation/schemas";
import { prisma } from "@/server/db/prisma";
import { requireSession } from "@/server/auth/require-session";
import { getEnv } from "@/lib/config/env";
import { headObject, sniffPdfMagic, MAX_RESUME_BYTES } from "@/server/storage/s3";
import { buildApplyUrl, generateRawToken, revokeLiveTokens } from "@/server/domain/tokens";
import { recordEvent } from "@/server/domain/state-machine";
import { logger } from "@/lib/logger";
import { ActionResult, fail, ok, zodFail } from "./result";

export async function createCandidateAction(
  input: unknown,
): Promise<ActionResult<{ candidateId: string; applyUrl: string }>> {
  await requireSession();
  const parsed = createCandidateSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { name, email, jobId, resumeKey, fileName, sizeBytes } = parsed.data;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return fail("Selected job opening no longer exists.");
  // Server-side enforcement — never trust that the UI hid closed jobs.
  if (job.status !== "OPEN") return fail("This opening is closed and cannot receive new candidates.");

  // Verify the uploaded object actually exists, is a PDF, and is within size —
  // the presigned POST policy enforces this too, but we re-check server-side.
  const head = await headObject(resumeKey);
  if (!head || (head.contentLength ?? 0) > MAX_RESUME_BYTES) {
    return fail("Resume upload could not be verified. Please re-upload the PDF.");
  }
  if (!(await sniffPdfMagic(resumeKey))) {
    return fail("Uploaded file is not a valid PDF.");
  }

  const token = generateRawToken();
  try {
    const candidate = await prisma.$transaction(async (tx) => {
      const c = await tx.candidate.create({
        data: { name, email: email.toLowerCase(), jobId, status: "APPLIED" },
      });
      await tx.document.create({
        data: {
          candidateId: c.id,
          kind: "RESUME",
          s3Key: resumeKey,
          fileName,
          mimeType: "application/pdf",
          sizeBytes,
        },
      });
      await tx.applicationToken.create({
        data: { candidateId: c.id, tokenHash: token.tokenHash, expiresAt: token.expiresAt },
      });
      await recordEvent(tx, c.id, {
        type: TimelineEventType.CANDIDATE_CREATED,
        actor: Actor.HR,
        payload: { jobTitle: job.title },
      });
      return c;
    });

    revalidatePath("/");
    revalidatePath("/jobs");
    logger.info("candidate.created", { candidateId: candidate.id, jobId });
    return ok({
      candidateId: candidate.id,
      applyUrl: buildApplyUrl(getEnv().APP_URL, token.raw),
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("A candidate with this email already applied to this opening.");
    }
    logger.error("candidate.create_failed", { error: String(e) });
    return fail("Could not create candidate. Please try again.");
  }
}

export async function regenerateMagicLinkAction(
  candidateId: string,
): Promise<ActionResult<{ applyUrl: string }>> {
  await requireSession();
  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate) return fail("Candidate not found.");
  if (candidate.status !== "APPLIED") {
    return fail("A new link can only be issued while the candidate is in Applied.");
  }

  const token = generateRawToken();
  await prisma.$transaction(async (tx) => {
    await revokeLiveTokens(tx, candidateId);
    await tx.applicationToken.create({
      data: { candidateId, tokenHash: token.tokenHash, expiresAt: token.expiresAt },
    });
    await recordEvent(tx, candidateId, { type: TimelineEventType.LINK_REGENERATED, actor: Actor.HR });
  });

  revalidatePath(`/candidates/${candidateId}`);
  return ok({ applyUrl: buildApplyUrl(getEnv().APP_URL, token.raw) });
}
