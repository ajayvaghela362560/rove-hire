"use server";

import { revalidatePath } from "next/cache";
import { Prisma, TimelineEventType, Actor, CandidateStatus } from "@prisma/client";
import { scheduleInterviewSchema, feedbackSchema } from "@/lib/validation/schemas";
import { prisma } from "@/server/db/prisma";
import { requireSession } from "@/server/auth/require-session";
import {
  transitionCandidate,
  recordEvent,
  DomainError,
} from "@/server/domain/state-machine";
import { InvalidTransitionError } from "@/server/domain/transitions";
import { ActionResult, fail, ok, zodFail } from "./result";

export async function scheduleInterviewAction(
  candidateId: string,
  input: unknown,
): Promise<ActionResult> {
  await requireSession();
  const parsed = scheduleInterviewSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const d = parsed.data;

  const scheduledAt = new Date(`${d.date}T${d.time}`);
  if (Number.isNaN(scheduledAt.getTime())) {
    return fail("Invalid interview date or time.", { date: "Invalid date/time" });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const interview = await tx.interview.create({
        data: {
          candidateId,
          scheduledAt,
          type: d.type,
          interviewerName: d.interviewerName,
          notes: d.notes || null,
        },
      });
      await transitionCandidate(
        tx,
        candidateId,
        CandidateStatus.INTERVIEW_SCHEDULED,
        {
          type: TimelineEventType.INTERVIEW_SCHEDULED,
          actor: Actor.HR,
          payload: {
            interviewId: interview.id,
            type: d.type,
            interviewer: d.interviewerName,
            scheduledAt: scheduledAt.toISOString(),
          },
        },
      );
    });
  } catch (e) {
    if (e instanceof InvalidTransitionError || e instanceof DomainError) {
      return fail("Cannot schedule an interview for a candidate in this status.");
    }
    throw e;
  }

  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath("/interviews");
  revalidatePath("/");
  return ok();
}

export async function completeInterviewAction(
  interviewId: string,
  input: unknown,
): Promise<ActionResult> {
  await requireSession();
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const interview = await prisma.interview.findUnique({ where: { id: interviewId } });
  if (!interview) return fail("Interview not found.");
  if (interview.status === "COMPLETED") return fail("This interview is already completed.");
  if (interview.status === "CANCELLED") return fail("This interview was cancelled.");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.interview.update({
        where: { id: interviewId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      await tx.feedback.create({
        data: { interviewId, verdict: parsed.data.verdict, note: parsed.data.note },
      });
      // Feedback does not change candidate status (F5.9) — just a timeline event.
      await recordEvent(tx, interview.candidateId, {
        type: TimelineEventType.FEEDBACK_RECORDED,
        actor: Actor.HR,
        payload: {
          interviewId,
          verdict: parsed.data.verdict,
          interviewer: interview.interviewerName,
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("Feedback has already been recorded for this interview.");
    }
    throw e;
  }

  revalidatePath(`/candidates/${interview.candidateId}`);
  revalidatePath("/interviews");
  revalidatePath("/");
  return ok();
}
