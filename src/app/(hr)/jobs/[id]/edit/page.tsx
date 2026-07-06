import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/server/db/prisma";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { JobForm } from "@/components/jobs/job-form";

export const metadata: Metadata = { title: "Edit Job Opening" };
export const dynamic = "force-dynamic";

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={`/jobs/${job.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to opening
      </Link>
      <PageHeader title="Edit job opening" description="Update details, skills, or open/close the role." />
      <Card>
        <CardContent className="pt-6">
          <JobForm
            mode="edit"
            job={{
              id: job.id,
              title: job.title,
              description: job.description,
              skills: job.skills,
              status: job.status,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
