import type { Metadata } from "next";
import Link from "next/link";
import type { CandidateStatus, Prisma } from "@prisma/client";
import { Users, ChevronRight } from "lucide-react";
import { prisma } from "@/server/db/prisma";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { DashboardFilters } from "@/components/dashboard/filters";
import { AddCandidateDialog } from "@/components/candidates/add-candidate-dialog";
import { ALL_CANDIDATE_STATUSES } from "@/lib/status";
import { relativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Candidates" };
export const dynamic = "force-dynamic";

function parseStatus(value?: string): CandidateStatus | undefined {
  return ALL_CANDIDATE_STATUSES.includes(value as CandidateStatus)
    ? (value as CandidateStatus)
    : undefined;
}

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const statusFilter = parseStatus(status);
  const query = q?.trim();

  const where: Prisma.CandidateWhereInput = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { job: { title: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [candidates, total, openJobs] = await Promise.all([
    prisma.candidate.findMany({
      where,
      include: { job: { select: { title: true } } },
      orderBy: { lastActivityAt: "desc" },
    }),
    prisma.candidate.count(),
    prisma.job.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidates"
        description="Every candidate in the pipeline, most recently active first."
        actions={<AddCandidateDialog openJobs={openJobs} />}
      />

      <DashboardFilters />

      {candidates.length === 0 ? (
        <EmptyState
          icon={Users}
          title={total === 0 ? "No candidates yet" : "No candidates match your filters"}
          description={
            total === 0
              ? "Add your first candidate to start tracking them through the pipeline."
              : "Try clearing the search or selecting a different status."
          }
          action={total === 0 ? <AddCandidateDialog openJobs={openJobs} /> : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Candidate</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Last activity</th>
                <th className="w-8 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="group border-b last:border-0 transition-colors hover:bg-accent/50">
                  <td className="px-4 py-3">
                    <Link href={`/candidates/${c.id}`} className="block">
                      <span className="font-medium text-foreground">{c.name}</span>
                      <span className="block text-xs text-muted-foreground">{c.email}</span>
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{c.job.title}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {relativeTime(c.lastActivityAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/candidates/${c.id}`}
                      className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label={`Open ${c.name}`}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
