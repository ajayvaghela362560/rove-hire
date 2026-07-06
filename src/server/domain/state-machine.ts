import { Prisma, CandidateStatus, TimelineEventType, Actor } from "@prisma/client";
import { assertCanTransition, isForward } from "./transitions";

/**
 * Transactional client type — every function here MUST run inside a
 * `prisma.$transaction(async (tx) => …)` so the row lock, guard, status write and
 * timeline event commit atomically or not at all.
 */
export type Tx = Prisma.TransactionClient;

export class DomainError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "ILLEGAL_TRANSITION"
      | "GUARD_FAILED"
      | "CONFLICT" = "GUARD_FAILED",
  ) {
    super(message);
    this.name = "DomainError";
  }
}

/** Lock the candidate row for the duration of the transaction (SELECT … FOR UPDATE). */
async function lockCandidate(tx: Tx, candidateId: string): Promise<CandidateStatus> {
  const rows = await tx.$queryRaw<{ status: CandidateStatus }[]>(
    Prisma.sql`SELECT "status" FROM "candidates" WHERE "id" = ${candidateId} FOR UPDATE`,
  );
  const row = rows[0];
  if (!row) throw new DomainError("Candidate not found", "NOT_FOUND");
  return row.status;
}

interface EventInput {
  type: TimelineEventType;
  actor?: Actor;
  payload?: Prisma.InputJsonValue;
  at?: Date;
}

/** Append a timeline event and bump last_activity_at in the same tx. */
export async function recordEvent(
  tx: Tx,
  candidateId: string,
  event: EventInput,
): Promise<void> {
  const at = event.at ?? new Date();
  await tx.timelineEvent.create({
    data: {
      candidateId,
      type: event.type,
      actor: event.actor ?? Actor.HR,
      payload: event.payload,
      createdAt: at,
    },
  });
  await tx.candidate.update({
    where: { id: candidateId },
    data: { lastActivityAt: at },
  });
}

/**
 * Change candidate status with the full guard sequence:
 * lock row → validate transition → run optional guard → write status + event.
 * Returns the resulting status.
 */
export async function transitionCandidate(
  tx: Tx,
  candidateId: string,
  to: CandidateStatus,
  event: EventInput,
  guard?: (current: CandidateStatus) => void | Promise<void>,
): Promise<CandidateStatus> {
  const current = await lockCandidate(tx, candidateId);
  assertCanTransition(current, to);
  if (guard) await guard(current);

  if (current !== to) {
    await tx.candidate.update({ where: { id: candidateId }, data: { status: to } });
  }
  await recordEvent(tx, candidateId, event);
  return to;
}

/**
 * Advance status only if `to` is ahead on the pipeline; otherwise keep the current
 * status but still record the event. Used by public form submission so a candidate
 * for whom HR already scheduled an interview is not regressed to Form Submitted.
 */
export async function advanceIfBehind(
  tx: Tx,
  candidateId: string,
  to: CandidateStatus,
  event: EventInput,
): Promise<CandidateStatus> {
  const current = await lockCandidate(tx, candidateId);
  const target = isForward(current, to) ? to : current;
  if (target !== current) {
    await tx.candidate.update({ where: { id: candidateId }, data: { status: target } });
  }
  await recordEvent(tx, candidateId, event);
  return target;
}
