import { z } from "zod";

export const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD"] as const;

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const jobSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(120),
  description: z.string().trim().min(1, "Description is required").max(20_000),
  skills: z.array(z.string().trim().min(1)).max(30).default([]),
  status: z.enum(["OPEN", "CLOSED"]).default("OPEN"),
});
export type JobInput = z.infer<typeof jobSchema>;

export const createCandidateSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().email("Enter a valid email"),
  jobId: z.string().min(1, "Select a job opening"),
  resumeKey: z.string().min(1, "Upload a resume"),
  fileName: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
});
export type CreateCandidateInput = z.infer<typeof createCandidateSchema>;

export const applicationSchema = z.object({
  phone: z.string().trim().min(4, "Phone is required").max(40),
  location: z.string().trim().min(2, "Location is required").max(120),
  currentRole: z.string().trim().min(2, "Current role is required").max(120),
  noticePeriod: z.string().trim().min(1, "Notice period is required").max(60),
  salaryExpectation: z.string().trim().min(1, "Salary expectation is required").max(60),
  linkedinUrl: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .refine((u) => /linkedin\.com/i.test(u), "Must be a LinkedIn URL"),
});
export type ApplicationInput = z.infer<typeof applicationSchema>;

export const scheduleInterviewSchema = z.object({
  date: z.string().min(1, "Date is required"), // yyyy-mm-dd
  time: z.string().min(1, "Time is required"), // HH:mm
  type: z.enum(["SCREENING", "TECHNICAL"]),
  interviewerName: z.string().trim().min(2, "Interviewer name is required").max(120),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type ScheduleInterviewInput = z.infer<typeof scheduleInterviewSchema>;

export const feedbackSchema = z.object({
  verdict: z.enum(["HIRE", "NO_HIRE", "MAYBE"]),
  note: z.string().trim().min(1, "Feedback note is required").max(4000),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;

export const offerSchema = z.object({
  roleTitle: z.string().trim().min(2, "Role title is required").max(120),
  salaryCurrency: z.enum(CURRENCIES),
  salaryAmount: z.coerce
    .number()
    .positive("Amount must be greater than zero")
    .max(100_000_000),
  startDate: z.string().min(1, "Start date is required"), // yyyy-mm-dd
  reportingManager: z.string().trim().min(2, "Reporting manager is required").max(120),
  location: z.string().trim().min(2, "Location is required").max(120),
});
export type OfferInput = z.infer<typeof offerSchema>;

export const rejectSchema = z.object({
  reason: z.string().trim().min(3, "A short reason is required").max(2000),
});
export type RejectInput = z.infer<typeof rejectSchema>;

export const presignSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.literal("application/pdf", {
    errorMap: () => ({ message: "Only PDF files are allowed" }),
  }),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024, "Max size is 10 MB"),
});
export type PresignInput = z.infer<typeof presignSchema>;
