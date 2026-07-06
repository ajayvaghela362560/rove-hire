import { describe, it, expect } from "vitest";
import {
  allowedActions,
  assertCanTransition,
  canTransition,
  InvalidTransitionError,
  isForward,
  isTerminal,
} from "@/server/domain/transitions";

describe("candidate status transitions", () => {
  it("permits the happy-path pipeline", () => {
    expect(canTransition("APPLIED", "FORM_SUBMITTED")).toBe(true);
    expect(canTransition("FORM_SUBMITTED", "INTERVIEW_SCHEDULED")).toBe(true);
    expect(canTransition("INTERVIEW_SCHEDULED", "OFFER_SENT")).toBe(true);
    expect(canTransition("OFFER_SENT", "HIRED")).toBe(true);
  });

  it("allows rejection from every non-terminal status", () => {
    for (const s of ["APPLIED", "FORM_SUBMITTED", "INTERVIEW_SCHEDULED", "OFFER_SENT"] as const) {
      expect(canTransition(s, "REJECTED")).toBe(true);
    }
  });

  it("blocks skipping straight to Hired without an offer", () => {
    expect(canTransition("APPLIED", "HIRED")).toBe(false);
    expect(canTransition("FORM_SUBMITTED", "HIRED")).toBe(false);
    expect(canTransition("INTERVIEW_SCHEDULED", "HIRED")).toBe(false);
  });

  it("blocks generating an offer before an interview is scheduled", () => {
    expect(canTransition("APPLIED", "OFFER_SENT")).toBe(false);
    expect(canTransition("FORM_SUBMITTED", "OFFER_SENT")).toBe(false);
  });

  it("treats Hired and Rejected as terminal", () => {
    expect(isTerminal("HIRED")).toBe(true);
    expect(isTerminal("REJECTED")).toBe(true);
    for (const to of ["APPLIED", "OFFER_SENT", "REJECTED"] as const) {
      expect(canTransition("HIRED", to)).toBe(false);
      expect(canTransition("REJECTED", to)).toBe(false);
    }
  });

  it("assertCanTransition throws on illegal moves but allows self-loops", () => {
    expect(() => assertCanTransition("APPLIED", "HIRED")).toThrow(InvalidTransitionError);
    expect(() => assertCanTransition("INTERVIEW_SCHEDULED", "INTERVIEW_SCHEDULED")).not.toThrow();
  });

  it("isForward only advances on the linear pipeline and ignores terminal", () => {
    expect(isForward("APPLIED", "FORM_SUBMITTED")).toBe(true);
    expect(isForward("INTERVIEW_SCHEDULED", "FORM_SUBMITTED")).toBe(false);
    expect(isForward("APPLIED", "REJECTED")).toBe(false);
    expect(isForward("REJECTED", "APPLIED")).toBe(false);
  });
});

describe("allowedActions (UI + server authority)", () => {
  const noCtx = { hasOffer: false, hasCompletedInterview: false };

  it("offers regenerate-link + schedule + reject when Applied", () => {
    expect(allowedActions("APPLIED", noCtx).sort()).toEqual(
      ["REGENERATE_LINK", "SCHEDULE_INTERVIEW", "REJECT"].sort(),
    );
  });

  it("offers generate-offer from Interview Scheduled", () => {
    expect(allowedActions("INTERVIEW_SCHEDULED", noCtx)).toContain("GENERATE_OFFER");
  });

  it("only allows Mark Hired at Offer Sent when an offer exists", () => {
    expect(allowedActions("OFFER_SENT", { ...noCtx, hasOffer: false })).not.toContain("MARK_HIRED");
    expect(allowedActions("OFFER_SENT", { ...noCtx, hasOffer: true })).toContain("MARK_HIRED");
  });

  it("offers no actions on terminal statuses", () => {
    expect(allowedActions("HIRED", { hasOffer: true, hasCompletedInterview: true })).toEqual([]);
    expect(allowedActions("REJECTED", noCtx)).toEqual([]);
  });
});
