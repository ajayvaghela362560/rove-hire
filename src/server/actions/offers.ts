"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { TimelineEventType, Actor, CandidateStatus } from "@prisma/client";
import { offerSchema } from "@/lib/validation/schemas";
import { prisma } from "@/server/db/prisma";
import { requireSession } from "@/server/auth/require-session";
import { transitionCandidate } from "@/server/domain/state-machine";
import { renderOfferLetter, renderNda } from "@/server/pdf/render";
import { putObject, offerDocKey } from "@/server/storage/s3";
import { formatCurrency, formatDate } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { ActionResult, fail, ok, zodFail } from "./result";

const OFFERABLE: CandidateStatus[] = ["INTERVIEW_SCHEDULED", "OFFER_SENT"];

export async function generateOfferDocumentsAction(
  candidateId: string,
  input: unknown,
): Promise<ActionResult> {
  await requireSession();
  const parsed = offerSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;

  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate) return fail("Candidate not found.");
  if (!OFFERABLE.includes(candidate.status)) {
    return fail("Offer documents can only be generated from Interview Scheduled or later.");
  }

  const offerId = `ofr_${randomBytes(12).toString("hex")}`;
  const reference = offerId.slice(-8).toUpperCase();
  const salaryMinor = Math.round(d.salaryAmount * 100);
  const salaryLabel = `${formatCurrency(salaryMinor, d.salaryCurrency)} ${d.salaryCurrency} per year`;
  const startDate = new Date(`${d.startDate}T00:00:00Z`);
  const now = new Date();

  // Files-first: render + upload before the DB transaction, so the DB can never
  // reference a missing file. Worst case on failure is an orphaned (invisible) object.
  let letterBuf: Buffer, ndaBuf: Buffer;
  try {
    [letterBuf, ndaBuf] = await Promise.all([
      renderOfferLetter({
        candidateName: candidate.name,
        roleTitle: d.roleTitle,
        salaryLabel,
        startDate: formatDate(startDate, { dateStyle: "long" }),
        reportingManager: d.reportingManager,
        location: d.location,
        generatedDate: formatDate(now, { dateStyle: "long" }),
        reference,
      }),
      renderNda({
        candidateName: candidate.name,
        date: formatDate(now, { dateStyle: "long" }),
        reference,
      }),
    ]);
  } catch (e) {
    logger.error("offer.render_failed", { candidateId, error: String(e) });
    return fail("Could not generate the documents. Please try again.");
  }

  const letterKey = offerDocKey(candidateId, offerId, "offer-letter");
  const ndaKey = offerDocKey(candidateId, offerId, "nda");
  try {
    await Promise.all([
      putObject(letterKey, letterBuf, "application/pdf"),
      putObject(ndaKey, ndaBuf, "application/pdf"),
    ]);
  } catch (e) {
    logger.error("offer.upload_failed", { candidateId, error: String(e) });
    return fail("Could not store the documents. Please try again.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.offer.create({
      data: {
        id: offerId,
        candidateId,
        roleTitle: d.roleTitle,
        salaryAmount: salaryMinor,
        salaryCurrency: d.salaryCurrency,
        startDate,
        reportingManager: d.reportingManager,
        workLocation: d.location,
      },
    });
    await tx.document.createMany({
      data: [
        {
          candidateId,
          offerId,
          kind: "OFFER_LETTER",
          s3Key: letterKey,
          fileName: `Offer Letter - ${candidate.name}.pdf`,
          mimeType: "application/pdf",
          sizeBytes: letterBuf.length,
        },
        {
          candidateId,
          offerId,
          kind: "NDA",
          s3Key: ndaKey,
          fileName: `NDA - ${candidate.name}.pdf`,
          mimeType: "application/pdf",
          sizeBytes: ndaBuf.length,
        },
      ],
    });
    await transitionCandidate(tx, candidateId, CandidateStatus.OFFER_SENT, {
      type: TimelineEventType.OFFER_GENERATED,
      actor: Actor.HR,
      payload: { roleTitle: d.roleTitle, salaryLabel, offerId },
    });
  });

  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath("/");
  logger.info("offer.generated", { candidateId, offerId });
  return ok();
}
