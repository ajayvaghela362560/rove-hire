import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, Plus, Users } from "lucide-react";
import { prisma } from "@/server/db/prisma";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Job Openings" };
export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const jobs = await prisma.job.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { candidates: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Openings"
        description="Create and manage the roles candidates apply for."
        actions={
          <Button asChild size="sm">
            <Link href="/jobs/new">
              <Plus /> New opening
            </Link>
          </Button>
        }
      />

      {jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No job openings yet"
          description="Create your first opening so you can start adding candidates to it."
          action={
            <Button asChild size="sm">
              <Link href="/jobs/new">
                <Plus /> New opening
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="group rounded-xl border bg-background p-5 transition-colors hover:border-primary/40 hover:bg-accent/30"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium leading-snug text-foreground group-hover:text-primary">
                  {job.title}
                </h3>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    job.status === "OPEN"
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                      : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
                  )}
                >
                  {job.status === "OPEN" ? "Open" : "Closed"}
                </span>
              </div>
              {job.skills.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {job.skills.slice(0, 5).map((s) => (
                    <span key={s} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                      {s}
                    </span>
                  ))}
                  {job.skills.length > 5 && (
                    <span className="px-1 py-0.5 text-xs text-muted-foreground">
                      +{job.skills.length - 5}
                    </span>
                  )}
                </div>
              )}
              <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {job._count.candidates} candidate{job._count.candidates === 1 ? "" : "s"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
