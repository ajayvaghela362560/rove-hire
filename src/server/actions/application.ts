"use server";

import { TimelineEventType, Actor, CandidateStatus } from "@prisma/client";
import { applicationSchema } from "@/lib/validation/schemas";
import { prisma } from "@/server/db/prisma";
import { claimToken, inspectToken } from "@/server/domain/tokens";
import { advanceIfBehind } from "@/server/domain/state-machine";
import { logger } from "@/lib/logger";
import { ActionResult, fail, ok, zodFail } from "./result";

/**
 * Public (no session). The token is the only credential — the candidate is derived
 * from it, never from a form field. Consumption is atomic (see claimToken).
 */
export async function submitApplicationAction(
  rawToken: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = applicationSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;

  try {
    const candidateId = await prisma.$transaction(async (tx) => {
      const claimed = await claimToken(tx, rawToken);
      if (!claimed) return null;
      await tx.candidate.update({
        where: { id: claimed },
        data: {
          phone: d.phone,
          location: d.location,
          currentRole: d.currentRole,
          noticePeriod: d.noticePeriod,
          salaryExpectation: d.salaryExpectation,
          linkedinUrl: d.linkedinUrl,
        },
      });
      // Advance to Form Submitted only if the candidate hasn't already moved past it
      // (HR may have scheduled an interview while the candidate was still Applied).
      await advanceIfBehind(tx, claimed, CandidateStatus.FORM_SUBMITTED, {
        type: TimelineEventType.FORM_SUBMITTED,
        actor: Actor.CANDIDATE,
      });
      return claimed;
    });

    if (!candidateId) {
      const state = await inspectToken(rawToken);
      const msg =
        state.state === "expired"
          ? "This link has expired."
          : "This application has already been submitted.";
      return fail(msg);
    }

    // No revalidatePath here: in a server action it also refreshes the caller's
    // current route, so /apply/[token] would re-render as "used" and replace the
    // candidate's success screen. HR pages are force-dynamic and always fetch fresh.
    logger.info("application.submitted", { candidateId });
    return ok();
  } catch (e) {
    logger.error("application.submit_failed", { error: String(e) });
    return fail("Could not submit your application. Please try again.");
  }
}
