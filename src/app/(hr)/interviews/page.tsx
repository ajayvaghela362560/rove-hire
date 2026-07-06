import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CalendarClock } from "lucide-react";
import { prisma } from "@/server/db/prisma";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompleteInterviewDialog } from "@/components/interviews/complete-interview-dialog";
import { VERDICT_META, INTERVIEW_TYPE_LABEL } from "@/lib/status";
import { formatDateTime, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Interviews" };
export const dynamic = "force-dynamic";

export default async function InterviewsPage() {
  const now = new Date();
  const interviews = await prisma.interview.findMany({
    where: { status: { not: "CANCELLED" } },
    orderBy: { scheduledAt: "asc" },
    include: {
      feedback: true,
      candidate: { select: { id: true, name: true, job: { select: { title: true } } } },
    },
  });

  const upcoming = interviews
    .filter((i) => i.status === "SCHEDULED" && i.scheduledAt >= now)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  const past = interviews
    .filter((i) => !(i.status === "SCHEDULED" && i.scheduledAt >= now))
    .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());

  return (
    <div className="space-y-6">
      <PageHeader title="Interviews" description="All scheduled and completed interviews, by date." />

      {interviews.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No interviews yet"
          description="Schedule an interview from a candidate's profile to see it here."
        />
      ) : (
        <div className="space-y-6">
          <Section title="Upcoming" icon={CalendarClock} count={upcoming.length}>
            {upcoming.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">No upcoming interviews.</p>
            ) : (
              upcoming.map((iv) => <InterviewRow key={iv.id} iv={iv} showComplete />)
            )}
          </Section>

          {past.length > 0 && (
            <Section title="Past" icon={CalendarDays} count={past.length}>
              {past.map((iv) => (
                <InterviewRow key={iv.id} iv={iv} />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: typeof CalendarDays;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">{count}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

type Row = {
  id: string;
  scheduledAt: Date;
  type: "SCREENING" | "TECHNICAL";
  interviewerName: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  feedback: { verdict: keyof typeof VERDICT_META; note: string } | null;
  candidate: { id: string; name: string; job: { title: string } };
};

function InterviewRow({ iv, showComplete }: { iv: Row; showComplete?: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/candidates/${iv.candidate.id}`} className="font-medium hover:text-primary hover:underline">
            {iv.candidate.name}
          </Link>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {INTERVIEW_TYPE_LABEL[iv.type]}
          </span>
          {iv.feedback && (
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", VERDICT_META[iv.feedback.verdict].className)}>
              {VERDICT_META[iv.feedback.verdict].label}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatDateTime(iv.scheduledAt)} · {iv.interviewerName} · {iv.candidate.job.title}
        </p>
      </div>
      {showComplete && iv.status === "SCHEDULED" && (
        <CompleteInterviewDialog interviewId={iv.id} label="Mark completed" />
      )}
    </div>
  );
}
