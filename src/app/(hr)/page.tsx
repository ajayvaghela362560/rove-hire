import Link from "next/link";
import type { CandidateStatus } from "@prisma/client";
import { ArrowRight, CalendarClock } from "lucide-react";
import { prisma } from "@/server/db/prisma";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { INTERVIEW_TYPE_LABEL } from "@/lib/status";
import { relativeTime, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const now = new Date();
  const [total, byStatus, recent, upcoming] = await Promise.all([
    prisma.candidate.count(),
    prisma.candidate.groupBy({ by: ["status"], _count: true }),
    prisma.candidate.findMany({
      orderBy: { lastActivityAt: "desc" },
      take: 6,
      include: { job: { select: { title: true } } },
    }),
    prisma.interview.findMany({
      where: { status: "SCHEDULED", scheduledAt: { gte: now } },
      orderBy: { scheduledAt: "asc" },
      take: 5,
      include: { candidate: { select: { id: true, name: true } } },
    }),
  ]);

  const count = (s: CandidateStatus) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const inPipeline =
    count("APPLIED") + count("FORM_SUBMITTED") + count("INTERVIEW_SCHEDULED") + count("OFFER_SENT");

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="An overview of your hiring pipeline." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total candidates" value={total} />
        <Stat label="In pipeline" value={inPipeline} />
        <Stat label="Offers out" value={count("OFFER_SENT")} />
        <Stat label="Hired" value={count("HIRED")} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent candidates */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">Recent activity</CardTitle>
            <Link href="/candidates" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {recent.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No candidates yet.</p>
            ) : (
              recent.map((c) => (
                <Link
                  key={c.id}
                  href={`/candidates/${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.job.title} · {relativeTime(c.lastActivityAt)}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Upcoming interviews */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">Upcoming interviews</CardTitle>
            <Link href="/interviews" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {upcoming.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No upcoming interviews.</p>
            ) : (
              upcoming.map((iv) => (
                <Link
                  key={iv.id}
                  href={`/candidates/${iv.candidate.id}`}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{iv.candidate.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {INTERVIEW_TYPE_LABEL[iv.type]} · {iv.interviewerName}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {formatDateTime(iv.scheduledAt)}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}
