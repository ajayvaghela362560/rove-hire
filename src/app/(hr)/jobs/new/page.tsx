import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { JobForm } from "@/components/jobs/job-form";

export const metadata: Metadata = { title: "New Job Opening" };

export default function NewJobPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="New job opening" description="Define the role candidates will apply for." />
      <Card>
        <CardContent className="pt-6">
          <JobForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
