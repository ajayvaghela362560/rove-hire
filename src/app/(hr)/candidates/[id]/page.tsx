import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Download,
  FileText,
  FileSignature,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Clock,
  Banknote,
  Briefcase,
  CalendarDays,
} from "lucide-react";
import type { DocumentKind } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { CandidateActions } from "@/components/candidates/candidate-actions";
import { MagicLinkCard } from "@/components/candidates/magic-link-card";
import { Timeline } from "@/components/candidates/timeline";
import { CompleteInterviewDialog } from "@/components/interviews/complete-interview-dialog";
import { VERDICT_META, INTERVIEW_TYPE_LABEL } from "@/lib/status";
import { formatDateTime, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const c = await prisma.candidate.findUnique({ where: { id }, select: { name: true } });
  return { title: c?.name ?? "Candidate" };
}

const DOC_ICON: Record<DocumentKind, typeof FileText> = {
  RESUME: FileText,
  OFFER_LETTER: FileSignature,
  NDA: ShieldCheck,
};
const DOC_LABEL: Record<DocumentKind, string> = {
  RESUME: "Resume",
  OFFER_LETTER: "Offer Letter",
  NDA: "NDA",
};

export default async function CandidateProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
      job: { select: { title: true } },
      documents: { orderBy: { createdAt: "desc" } },
      interviews: { orderBy: { scheduledAt: "desc" }, include: { feedback: true } },
      offers: { select: { id: true } },
      events: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!candidate) notFound();

  const hasOffer = candidate.offers.length > 0;
  const hasCompletedInterview = candidate.interviews.some((i) => i.status === "COMPLETED");
  const formSubmitted = Boolean(candidate.phone);

  return (
    <div className="space-y-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to candidates
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{candidate.name}</h1>
            <StatusBadge status={candidate.status} />
          </div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5" /> {candidate.job.title}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> {candidate.email}
            </span>
          </p>
        </div>
        <CandidateActions
          candidateId={candidate.id}
          status={candidate.status}
          defaultRole={candidate.job.title}
          defaultLocation={candidate.location ?? undefined}
          hasOffer={hasOffer}
          hasCompletedInterview={hasCompletedInterview}
        />
      </div>

      {candidate.status === "REJECTED" && candidate.rejectionReason && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <span className="font-medium">Rejection reason:</span> {candidate.rejectionReason}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Main column */}
        <div className="space-y-6">
          {/* Candidate details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Candidate details</CardTitle>
            </CardHeader>
            <CardContent>
              {formSubmitted ? (
                <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  <Info icon={Phone} label="Phone" value={candidate.phone} />
                  <Info icon={MapPin} label="Location" value={candidate.location} />
                  <Info icon={Briefcase} label="Current role" value={candidate.currentRole} />
                  <Info icon={Clock} label="Notice period" value={candidate.noticePeriod} />
                  <Info icon={Banknote} label="Salary expectation" value={candidate.salaryExpectation} />
                  <Info
                    icon={Linkedin}
                    label="LinkedIn"
                    value={candidate.linkedinUrl}
                    href={candidate.linkedinUrl ?? undefined}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Awaiting the candidate&apos;s application form. Details will appear here once they
                  complete it.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {candidate.documents.map((doc) => {
                const Icon = DOC_ICON[doc.kind];
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{DOC_LABEL[doc.kind]}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {(doc.sizeBytes / 1024).toFixed(0)} KB · {formatDateTime(doc.createdAt)}
                        </p>
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <a href={`/api/documents/${doc.id}/download`}>
                        <Download /> Download
                      </a>
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Interviews */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Interviews</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {candidate.interviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No interviews scheduled yet.</p>
              ) : (
                candidate.interviews.map((iv) => (
                  <div key={iv.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                          {INTERVIEW_TYPE_LABEL[iv.type]} interview
                          {iv.status === "CANCELLED" && (
                            <span className="text-xs font-normal text-muted-foreground">(cancelled)</span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDateTime(iv.scheduledAt)} · {iv.interviewerName}
                        </p>
                        {iv.notes && <p className="mt-1 text-sm text-muted-foreground">{iv.notes}</p>}
                      </div>
                      {iv.status === "SCHEDULED" && <CompleteInterviewDialog interviewId={iv.id} />}
                    </div>
                    {iv.feedback && (
                      <div className="mt-3 rounded-md bg-muted/50 p-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            VERDICT_META[iv.feedback.verdict].className,
                          )}
                        >
                          {VERDICT_META[iv.feedback.verdict].label}
                        </span>
                        <p className="mt-2 text-sm text-foreground">{iv.feedback.note}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {candidate.status === "APPLIED" && <MagicLinkCard candidateId={candidate.id} />}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Activity timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline events={candidate.events} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Mail;
  label: string;
  value?: string | null;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="truncate text-sm text-primary hover:underline">
            {value ?? "—"}
          </a>
        ) : (
          <p className="truncate text-sm font-medium">{value ?? "—"}</p>
        )}
      </div>
    </div>
  );
}
