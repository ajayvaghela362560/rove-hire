/**
 * Idempotent seed. Populates the exact demo states the brief requires:
 *   3+ job openings (incl. one Closed) and 5 candidates — one each in
 *   Applied, Form Submitted, Interview Scheduled (with feedback), Offer Sent
 *   (with real generated PDFs), and Rejected.
 *
 * It uses the SAME pipelines the app uses — real PDF rendering (@react-pdf),
 * real S3 uploads, real token hashing — so every download link a reviewer clicks
 * works, and timelines are coherent and back-dated to look like a living pipeline.
 *
 * Safe to re-run: all rows are keyed by deterministic IDs and only seed-tagged
 * rows are ever touched. No global deletes.
 */
import {
  PrismaClient,
  type CandidateStatus,
  type TimelineEventType,
  type Actor,
  type Prisma,
} from "@prisma/client";
import { getEnv } from "@/lib/config/env";
import { hashPassword } from "@/server/auth/password";
import { generateRawToken, buildApplyUrl } from "@/server/domain/tokens";
import { renderResume, renderOfferLetter, renderNda } from "@/server/pdf/render";
import { putObject, offerDocKey } from "@/server/storage/s3";
import { formatCurrency, formatDate } from "@/lib/utils";

const prisma = new PrismaClient();
const env = getEnv();

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(now - n * DAY);
const daysAhead = (n: number) => new Date(now + n * DAY);

interface EventSpec {
  type: TimelineEventType;
  actor?: Actor;
  payload?: Prisma.InputJsonValue;
  at: Date;
}

async function resetCandidate(id: string) {
  await prisma.timelineEvent.deleteMany({ where: { candidateId: id } });
  await prisma.feedback.deleteMany({ where: { interview: { candidateId: id } } });
  await prisma.interview.deleteMany({ where: { candidateId: id } });
  await prisma.document.deleteMany({ where: { candidateId: id } });
  await prisma.offer.deleteMany({ where: { candidateId: id } });
  await prisma.applicationToken.deleteMany({ where: { candidateId: id } });
  await prisma.candidate.deleteMany({ where: { id } });
}

async function addEvents(candidateId: string, events: EventSpec[]) {
  for (const e of events) {
    await prisma.timelineEvent.create({
      data: {
        candidateId,
        type: e.type,
        actor: e.actor ?? "HR",
        payload: e.payload,
        createdAt: e.at,
      },
    });
  }
  const last = events[events.length - 1]?.at ?? new Date();
  await prisma.candidate.update({ where: { id: candidateId }, data: { lastActivityAt: last } });
}

async function uploadResume(candidateId: string, name: string, title: string, contact: {
  email: string;
  phone: string;
  location: string;
}) {
  const buf = await renderResume({
    name,
    title,
    email: contact.email,
    phone: contact.phone,
    location: contact.location,
    summary: `${title} with a track record of shipping production systems end to end. Strong focus on clean architecture, performance, and pragmatic delivery.`,
    skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "AWS", "CI/CD"],
    experiences: [
      {
        role: "Senior Engineer",
        company: "Prior Company",
        period: "2022 — Present",
        points: [
          "Led delivery of customer-facing features used by thousands of users.",
          "Improved performance and reliability across critical paths.",
        ],
      },
      {
        role: "Software Engineer",
        company: "Earlier Company",
        period: "2020 — 2022",
        points: ["Built and maintained REST APIs and React front-ends in an agile team."],
      },
    ],
  });
  const key = `resumes/seed/${candidateId}.pdf`;
  await putObject(key, buf, "application/pdf");
  await prisma.document.create({
    data: {
      candidateId,
      kind: "RESUME",
      s3Key: key,
      fileName: `Resume - ${name}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: buf.length,
    },
  });
}

async function main() {
  console.log("Seeding ROVE Hire…");

  // ── HR user ──────────────────────────────────────────────────────────────
  const password = env.SEED_HR_PASSWORD as string;
  const passwordHash = await hashPassword(password);
  await prisma.hrUser.upsert({
    where: { email: "hr@rovehire.dev" },
    update: { passwordHash, name: "Sky Recruiter" },
    create: { id: "seed-hr", email: "hr@rovehire.dev", name: "Sky Recruiter", passwordHash },
  });

  // ── Jobs ─────────────────────────────────────────────────────────────────
  const jobs = [
    {
      id: "seed-job-fullstack",
      title: "Senior Full-Stack Engineer",
      status: "OPEN" as const,
      skills: ["TypeScript", "Next.js", "Node.js", "PostgreSQL", "AWS"],
      description: `## About the role\nBuild the internal tools and customer platforms that power ROVE's connected dashcam ecosystem.\n\n### You will\n- Own features end to end, from schema to UI\n- Design REST APIs and relational schemas\n- Ship with CI/CD to production\n\n**Stack:** Next.js · Node.js · PostgreSQL · AWS`,
    },
    {
      id: "seed-job-firmware",
      title: "Embedded Firmware Engineer",
      status: "OPEN" as const,
      skills: ["C", "C++", "RTOS", "I2C", "Linux"],
      description: `## About the role\nDevelop firmware for next-generation ROVE dashcam hardware.\n\n### Responsibilities\n- Write efficient, testable embedded C/C++\n- Work close to the metal with sensors and peripherals\n- Collaborate with hardware and cloud teams`,
    },
    {
      id: "seed-job-design",
      title: "Product Designer",
      status: "OPEN" as const,
      skills: ["Figma", "Prototyping", "Design Systems"],
      description: `## About the role\nShape the end-to-end experience of ROVE's companion apps.\n\n- Own flows, not just screens\n- Build and maintain the design system\n- Partner closely with engineering`,
    },
    {
      id: "seed-job-ops",
      title: "Operations Coordinator",
      status: "CLOSED" as const,
      skills: ["Logistics", "Excel", "Communication"],
      description: `## About the role\nCoordinate logistics and fulfilment for ROVE hardware. *(This role is now closed.)*`,
    },
  ];
  for (const j of jobs) {
    await prisma.job.upsert({
      where: { id: j.id },
      update: { title: j.title, status: j.status, skills: j.skills, description: j.description },
      create: j,
    });
  }

  // ── Candidate A — Applied (with a live magic link) ────────────────────────
  const A = "seed-cand-applied";
  await resetCandidate(A);
  await prisma.candidate.create({
    data: {
      id: A,
      jobId: "seed-job-fullstack",
      name: "Priya Nair",
      email: "priya.nair@example.com",
      status: "APPLIED" as CandidateStatus,
      createdAt: daysAgo(2),
    },
  });
  await uploadResume(A, "Priya Nair", "Full-Stack Engineer", {
    email: "priya.nair@example.com",
    phone: "+91 98200 11223",
    location: "Bengaluru, India",
  });
  const token = generateRawToken();
  await prisma.applicationToken.create({
    data: { candidateId: A, tokenHash: token.tokenHash, expiresAt: token.expiresAt },
  });
  await addEvents(A, [
    { type: "CANDIDATE_CREATED", at: daysAgo(2), payload: { jobTitle: "Senior Full-Stack Engineer" } },
  ]);
  const applyUrl = buildApplyUrl(env.APP_URL, token.raw);

  // ── Candidate B — Form Submitted ──────────────────────────────────────────
  const B = "seed-cand-form";
  await resetCandidate(B);
  await prisma.candidate.create({
    data: {
      id: B,
      jobId: "seed-job-fullstack",
      name: "Marcus Chen",
      email: "marcus.chen@example.com",
      status: "FORM_SUBMITTED" as CandidateStatus,
      phone: "+1 415 555 0142",
      location: "San Francisco, CA",
      currentRole: "Full-Stack Engineer at Northwind",
      noticePeriod: "30 days",
      salaryExpectation: "$150,000",
      linkedinUrl: "https://linkedin.com/in/marcuschen",
      createdAt: daysAgo(10),
    },
  });
  await uploadResume(B, "Marcus Chen", "Full-Stack Engineer", {
    email: "marcus.chen@example.com",
    phone: "+1 415 555 0142",
    location: "San Francisco, CA",
  });
  await prisma.applicationToken.create({
    data: {
      candidateId: B,
      tokenHash: generateRawToken().tokenHash,
      expiresAt: daysAhead(4),
      usedAt: daysAgo(9),
    },
  });
  await addEvents(B, [
    { type: "CANDIDATE_CREATED", at: daysAgo(10), payload: { jobTitle: "Senior Full-Stack Engineer" } },
    { type: "FORM_SUBMITTED", actor: "CANDIDATE", at: daysAgo(9) },
  ]);

  // ── Candidate C — Interview Scheduled (with feedback) ─────────────────────
  const C = "seed-cand-interview";
  await resetCandidate(C);
  await prisma.candidate.create({
    data: {
      id: C,
      jobId: "seed-job-firmware",
      name: "Aisha Khan",
      email: "aisha.khan@example.com",
      status: "INTERVIEW_SCHEDULED" as CandidateStatus,
      phone: "+44 7700 900123",
      location: "London, UK",
      currentRole: "Firmware Engineer at Volt",
      noticePeriod: "2 months",
      salaryExpectation: "£85,000",
      linkedinUrl: "https://linkedin.com/in/aishakhan",
      createdAt: daysAgo(12),
    },
  });
  await uploadResume(C, "Aisha Khan", "Embedded Firmware Engineer", {
    email: "aisha.khan@example.com",
    phone: "+44 7700 900123",
    location: "London, UK",
  });
  const cScreening = await prisma.interview.create({
    data: {
      candidateId: C,
      scheduledAt: daysAgo(6),
      type: "SCREENING",
      interviewerName: "Jordan Avery",
      status: "COMPLETED",
      completedAt: daysAgo(5),
      notes: "Intro screening call.",
      createdAt: daysAgo(8),
    },
  });
  await prisma.feedback.create({
    data: {
      interviewId: cScreening.id,
      verdict: "MAYBE",
      note: "Solid fundamentals and good communication. Want a technical round to confirm depth on RTOS.",
      createdAt: daysAgo(5),
    },
  });
  await prisma.interview.create({
    data: {
      candidateId: C,
      scheduledAt: daysAhead(3),
      type: "TECHNICAL",
      interviewerName: "Sam Rivera",
      status: "SCHEDULED",
      notes: "Deep-dive on embedded C and peripherals.",
      createdAt: daysAgo(4),
    },
  });
  await addEvents(C, [
    { type: "CANDIDATE_CREATED", at: daysAgo(12), payload: { jobTitle: "Embedded Firmware Engineer" } },
    { type: "FORM_SUBMITTED", actor: "CANDIDATE", at: daysAgo(11) },
    { type: "INTERVIEW_SCHEDULED", at: daysAgo(8), payload: { type: "SCREENING", interviewer: "Jordan Avery" } },
    { type: "FEEDBACK_RECORDED", at: daysAgo(5), payload: { verdict: "MAYBE", interviewer: "Jordan Avery" } },
    { type: "INTERVIEW_SCHEDULED", at: daysAgo(4), payload: { type: "TECHNICAL", interviewer: "Sam Rivera" } },
  ]);

  // ── Candidate D — Offer Sent (with real generated PDFs) ───────────────────
  const D = "seed-cand-offer";
  await resetCandidate(D);
  await prisma.candidate.create({
    data: {
      id: D,
      jobId: "seed-job-fullstack",
      name: "Diego Ramirez",
      email: "diego.ramirez@example.com",
      status: "OFFER_SENT" as CandidateStatus,
      phone: "+1 512 555 0199",
      location: "Austin, TX",
      currentRole: "Senior Engineer at Cloudsmith",
      noticePeriod: "3 weeks",
      salaryExpectation: "$160,000",
      linkedinUrl: "https://linkedin.com/in/diegoramirez",
      createdAt: daysAgo(20),
    },
  });
  await uploadResume(D, "Diego Ramirez", "Senior Full-Stack Engineer", {
    email: "diego.ramirez@example.com",
    phone: "+1 512 555 0199",
    location: "Austin, TX",
  });
  const dInterview = await prisma.interview.create({
    data: {
      candidateId: D,
      scheduledAt: daysAgo(16),
      type: "TECHNICAL",
      interviewerName: "Sam Rivera",
      status: "COMPLETED",
      completedAt: daysAgo(15),
      createdAt: daysAgo(18),
    },
  });
  await prisma.feedback.create({
    data: {
      interviewId: dInterview.id,
      verdict: "HIRE",
      note: "Excellent system design and hands-on coding. Strong hire — move to offer.",
      createdAt: daysAgo(15),
    },
  });
  // Real offer + NDA PDFs through the actual pipeline.
  const offerId = "seed-offer-diego";
  const salaryMinor = 155_000_00;
  const currency = "USD";
  const startDate = daysAhead(30);
  const reference = offerId.slice(-8).toUpperCase();
  const [letterBuf, ndaBuf] = await Promise.all([
    renderOfferLetter({
      candidateName: "Diego Ramirez",
      roleTitle: "Senior Full-Stack Engineer",
      salaryLabel: `${formatCurrency(salaryMinor, currency)} ${currency} per year`,
      startDate: formatDate(startDate, { dateStyle: "long" }),
      reportingManager: "Jordan Avery",
      location: "Austin, TX (Hybrid)",
      generatedDate: formatDate(daysAgo(6), { dateStyle: "long" }),
      reference,
    }),
    renderNda({
      candidateName: "Diego Ramirez",
      date: formatDate(daysAgo(6), { dateStyle: "long" }),
      reference,
    }),
  ]);
  const letterKey = offerDocKey(D, offerId, "offer-letter");
  const ndaKey = offerDocKey(D, offerId, "nda");
  await Promise.all([
    putObject(letterKey, letterBuf, "application/pdf"),
    putObject(ndaKey, ndaBuf, "application/pdf"),
  ]);
  await prisma.offer.create({
    data: {
      id: offerId,
      candidateId: D,
      roleTitle: "Senior Full-Stack Engineer",
      salaryAmount: salaryMinor,
      salaryCurrency: currency,
      startDate,
      reportingManager: "Jordan Avery",
      workLocation: "Austin, TX (Hybrid)",
      createdAt: daysAgo(6),
    },
  });
  await prisma.document.createMany({
    data: [
      { candidateId: D, offerId, kind: "OFFER_LETTER", s3Key: letterKey, fileName: "Offer Letter - Diego Ramirez.pdf", mimeType: "application/pdf", sizeBytes: letterBuf.length, createdAt: daysAgo(6) },
      { candidateId: D, offerId, kind: "NDA", s3Key: ndaKey, fileName: "NDA - Diego Ramirez.pdf", mimeType: "application/pdf", sizeBytes: ndaBuf.length, createdAt: daysAgo(6) },
    ],
  });
  await addEvents(D, [
    { type: "CANDIDATE_CREATED", at: daysAgo(20), payload: { jobTitle: "Senior Full-Stack Engineer" } },
    { type: "FORM_SUBMITTED", actor: "CANDIDATE", at: daysAgo(19) },
    { type: "INTERVIEW_SCHEDULED", at: daysAgo(18), payload: { type: "TECHNICAL", interviewer: "Sam Rivera" } },
    { type: "FEEDBACK_RECORDED", at: daysAgo(15), payload: { verdict: "HIRE", interviewer: "Sam Rivera" } },
    { type: "OFFER_GENERATED", at: daysAgo(6), payload: { roleTitle: "Senior Full-Stack Engineer", salaryLabel: `${formatCurrency(salaryMinor, currency)} ${currency} per year`, offerId } },
  ]);

  // ── Candidate E — Rejected ────────────────────────────────────────────────
  const E = "seed-cand-rejected";
  await resetCandidate(E);
  await prisma.candidate.create({
    data: {
      id: E,
      jobId: "seed-job-design",
      name: "Sarah Johnson",
      email: "sarah.johnson@example.com",
      status: "REJECTED" as CandidateStatus,
      phone: "+1 646 555 0177",
      location: "New York, NY",
      currentRole: "Product Designer at Brightline",
      noticePeriod: "1 month",
      salaryExpectation: "$130,000",
      linkedinUrl: "https://linkedin.com/in/sarahjohnson",
      rejectionReason: "Strong portfolio, but we moved forward with a candidate who had more design-systems depth.",
      createdAt: daysAgo(15),
    },
  });
  await uploadResume(E, "Sarah Johnson", "Product Designer", {
    email: "sarah.johnson@example.com",
    phone: "+1 646 555 0177",
    location: "New York, NY",
  });
  const eInterview = await prisma.interview.create({
    data: {
      candidateId: E,
      scheduledAt: daysAgo(11),
      type: "SCREENING",
      interviewerName: "Jordan Avery",
      status: "COMPLETED",
      completedAt: daysAgo(10),
      createdAt: daysAgo(13),
    },
  });
  await prisma.feedback.create({
    data: {
      interviewId: eInterview.id,
      verdict: "NO_HIRE",
      note: "Good communicator; portfolio didn't show enough systems thinking for this role.",
      createdAt: daysAgo(10),
    },
  });
  await addEvents(E, [
    { type: "CANDIDATE_CREATED", at: daysAgo(15), payload: { jobTitle: "Product Designer" } },
    { type: "FORM_SUBMITTED", actor: "CANDIDATE", at: daysAgo(14) },
    { type: "INTERVIEW_SCHEDULED", at: daysAgo(13), payload: { type: "SCREENING", interviewer: "Jordan Avery" } },
    { type: "FEEDBACK_RECORDED", at: daysAgo(10), payload: { verdict: "NO_HIRE", interviewer: "Jordan Avery" } },
    { type: "REJECTED", at: daysAgo(6), payload: { reason: "Strong portfolio, but we moved forward with a candidate who had more design-systems depth." } },
  ]);

  console.log("\n✅ Seed complete.\n");
  console.log("HR login:  hr@rovehire.dev  /  " + password);
  console.log("\nLive application link for the Applied candidate (Priya Nair):");
  console.log("  " + applyUrl + "\n");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
