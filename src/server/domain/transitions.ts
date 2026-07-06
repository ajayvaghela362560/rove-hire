import { CandidateStatus } from "@prisma/client";

/**
 * Pure candidate status rules. No DB, no framework — unit-tested in isolation and
 * imported by BOTH the server (authority) and the UI (which buttons to render),
 * so client affordances and server enforcement can never diverge.
 */

/** Linear pipeline rank; REJECTED is off-pipeline (terminal). */
export const STATUS_RANK: Record<CandidateStatus, number> = {
  APPLIED: 0,
  FORM_SUBMITTED: 1,
  INTERVIEW_SCHEDULED: 2,
  OFFER_SENT: 3,
  HIRED: 4,
  REJECTED: -1,
};

/** Allowed status-changing transitions. Self-loops (idempotent) are handled separately. */
export const ALLOWED_TRANSITIONS: Record<CandidateStatus, CandidateStatus[]> = {
  APPLIED: ["FORM_SUBMITTED", "INTERVIEW_SCHEDULED", "REJECTED"],
  FORM_SUBMITTED: ["INTERVIEW_SCHEDULED", "REJECTED"],
  INTERVIEW_SCHEDULED: ["OFFER_SENT", "REJECTED"],
  OFFER_SENT: ["HIRED", "REJECTED"],
  HIRED: [],
  REJECTED: [],
};

export const TERMINAL_STATUSES: CandidateStatus[] = ["HIRED", "REJECTED"];

export function isTerminal(status: CandidateStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function canTransition(from: CandidateStatus, to: CandidateStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(from: CandidateStatus, to: CandidateStatus) {
    super(`Illegal status transition: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function assertCanTransition(from: CandidateStatus, to: CandidateStatus): void {
  if (from === to) return; // idempotent no-op, decided by the caller
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

/** True when `to` is strictly ahead of `from` on the linear pipeline. */
export function isForward(from: CandidateStatus, to: CandidateStatus): boolean {
  if (STATUS_RANK[from] < 0 || STATUS_RANK[to] < 0) return false; // terminal involved
  return STATUS_RANK[to] > STATUS_RANK[from];
}

export type CandidateAction =
  | "REGENERATE_LINK"
  | "SCHEDULE_INTERVIEW"
  | "GENERATE_OFFER"
  | "MARK_HIRED"
  | "REJECT";

export interface ActionContext {
  hasOffer: boolean;
  hasCompletedInterview: boolean;
}

/**
 * The single source of truth for "which actions are legal right now". Rendered as
 * buttons by the profile and re-checked server-side before every mutation.
 */
export function allowedActions(
  status: CandidateStatus,
  ctx: ActionContext,
): CandidateAction[] {
  if (isTerminal(status)) return [];
  const actions: CandidateAction[] = [];

  if (status === "APPLIED") actions.push("REGENERATE_LINK");
  if (["APPLIED", "FORM_SUBMITTED", "INTERVIEW_SCHEDULED"].includes(status)) {
    actions.push("SCHEDULE_INTERVIEW");
  }
  // Feature 7 is authoritative: available from Interview Scheduled or later.
  // (A non-blocking warning is shown in the UI when hasCompletedInterview is false.)
  if (["INTERVIEW_SCHEDULED", "OFFER_SENT"].includes(status)) {
    actions.push("GENERATE_OFFER");
  }
  // Hired requires an offer to exist first — practically reachable only at OFFER_SENT.
  if (status === "OFFER_SENT" && ctx.hasOffer) actions.push("MARK_HIRED");

  actions.push("REJECT"); // any non-terminal status
  return actions;
}

export function isActionAllowed(
  status: CandidateStatus,
  action: CandidateAction,
  ctx: ActionContext,
): boolean {
  return allowedActions(status, ctx).includes(action);
}
