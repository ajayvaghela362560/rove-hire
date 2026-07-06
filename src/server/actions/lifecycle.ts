"use server";

import { revalidatePath } from "next/cache";
import { TimelineEventType, Actor, CandidateStatus } from "@prisma/client";
import { rejectSchema } from "@/lib/validation/schemas";
import { prisma } from "@/server/db/prisma";
import { requireSession } from "@/server/auth/require-session";
import {
  transitionCandidate,
  DomainError,
} from "@/server/domain/state-machine";
import { InvalidTransitionError } from "@/server/domain/transitions";
import { revokeLiveTokens } from "@/server/domain/tokens";
import { ActionResult, fail, ok, zodFail } from "./result";

export async function markHiredAction(candidateId: string): Promise<ActionResult> {
  await requireSession();
  try {
    await prisma.$transaction(async (tx) => {
      await transitionCandidate(
        tx,
        candidateId,
        CandidateStatus.HIRED,
        { type: TimelineEventType.HIRED, actor: Actor.HR },
        async () => {
          // Hired requires an actual offer to exist first.
          const offers = await tx.offer.count({ where: { candidateId } });
          if (offers === 0) {
            throw new DomainError("An offer must be generated before hiring.", "GUARD_FAILED");
          }
        },
      );
    });
  } catch (e) {
    if (e instanceof InvalidTransitionError) {
      return fail("This candidate cannot be marked as hired from their current status.");
    }
    if (e instanceof DomainError) return fail(e.message);
    throw e;
  }

  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath("/");
  return ok();
}

export async function markRejectedAction(
  candidateId: string,
  input: unknown,
): Promise<ActionResult> {
  await requireSession();
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  try {
    await prisma.$transaction(async (tx) => {
      // Set the reason first so the DB CHECK (status=REJECTED ⇒ reason NOT NULL) holds
      // when the status flips within the same transaction.
      await tx.candidate.update({
        where: { id: candidateId },
        data: { rejectionReason: parsed.data.reason },
      });
      await transitionCandidate(tx, candidateId, CandidateStatus.REJECTED, {
        type: TimelineEventType.REJECTED,
        actor: Actor.HR,
        payload: { reason: parsed.data.reason },
      });
      // Kill any outstanding application link and cancel future interviews.
      await revokeLiveTokens(tx, candidateId);
      await tx.interview.updateMany({
        where: { candidateId, status: "SCHEDULED", scheduledAt: { gt: new Date() } },
        data: { status: "CANCELLED" },
      });
    });
  } catch (e) {
    if (e instanceof InvalidTransitionError) {
      return fail("This candidate is already in a terminal status.");
    }
    if (e instanceof DomainError) return fail(e.message);
    throw e;
  }

  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath("/interviews");
  revalidatePath("/");
  return ok();
}
