import type { CandidateStatus, FeedbackVerdict, InterviewType } from "@prisma/client";

interface StatusMeta {
  label: string;
  /** Pill classes — one consistent color map used on the dashboard, profile, and timeline. */
  className: string;
  dot: string;
}

export const CANDIDATE_STATUS_META: Record<CandidateStatus, StatusMeta> = {
  APPLIED: {
    label: "Applied",
    className: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
    dot: "bg-slate-400",
  },
  FORM_SUBMITTED: {
    label: "Form Submitted",
    className: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200",
    dot: "bg-sky-500",
  },
  INTERVIEW_SCHEDULED: {
    label: "Interview Scheduled",
    className: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
    dot: "bg-amber-500",
  },
  OFFER_SENT: {
    label: "Offer Sent",
    className: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200",
    dot: "bg-violet-500",
  },
  HIRED: {
    label: "Hired",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
    dot: "bg-emerald-500",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
    dot: "bg-rose-500",
  },
};

export const ALL_CANDIDATE_STATUSES: CandidateStatus[] = [
  "APPLIED",
  "FORM_SUBMITTED",
  "INTERVIEW_SCHEDULED",
  "OFFER_SENT",
  "HIRED",
  "REJECTED",
];

export const VERDICT_META: Record<FeedbackVerdict, { label: string; className: string }> = {
  HIRE: { label: "Hire", className: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200" },
  NO_HIRE: { label: "No Hire", className: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200" },
  MAYBE: { label: "Maybe", className: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200" },
};

export const INTERVIEW_TYPE_LABEL: Record<InterviewType, string> = {
  SCREENING: "Screening",
  TECHNICAL: "Technical",
};
