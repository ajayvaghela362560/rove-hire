import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import { prisma } from "@/server/db/prisma";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AddCandidateForm } from "@/components/candidates/add-candidate-form";

export const metadata: Metadata = { title: "Add Candidate" };
export const dynamic = "force-dynamic";

export default async function NewCandidatePage() {
  // Only OPEN jobs can receive new candidates.
  const openJobs = await prisma.job.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Add candidate" description="Upload a resume, pick the role, and generate an application link." />
      {openJobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No open roles"
          description="You need at least one open job opening before adding a candidate."
          action={
            <Button asChild size="sm">
              <Link href="/jobs/new">Create an opening</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <AddCandidateForm openJobs={openJobs} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
