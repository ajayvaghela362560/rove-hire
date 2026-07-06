import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, Pencil } from "lucide-react";
import { prisma } from "@/server/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/common/markdown";
import { StatusBadge } from "@/components/common/status-badge";
import { relativeTime, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id }, select: { title: true } });
  return { title: job?.title ?? "Job Opening" };
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      candidates: {
        orderBy: { lastActivityAt: "desc" },
        select: { id: true, name: true, status: true, lastActivityAt: true },
      },
    },
  });
  if (!job) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to openings
      </Link>

      <div className="flex flex-col gap-3 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{job.title}</h1>
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
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {job.candidates.length} candidate{job.candidates.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/jobs/${job.id}/edit`}>
            <Pencil /> Edit opening
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Description</CardTitle>
            </CardHeader>
            <CardContent>
              {job.description.trim() ? (
                <Markdown>{job.description}</Markdown>
              ) : (
                <p className="text-sm text-muted-foreground">No description provided.</p>
              )}
            </CardContent>
          </Card>

          {job.skills.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Required skills</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {job.skills.map((s) => (
                    <span key={s} className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                      {s}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              Candidates ({job.candidates.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {job.candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No candidates on this opening yet.</p>
            ) : (
              job.candidates.map((c) => (
                <Link
                  key={c.id}
                  href={`/candidates/${c.id}`}
                  className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm transition-colors hover:bg-accent/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{relativeTime(c.lastActivityAt)}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
