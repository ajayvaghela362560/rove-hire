import type { Metadata } from "next";
import { Clock, LinkIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { prisma } from "@/server/db/prisma";
import { inspectToken } from "@/server/domain/tokens";
import { Logo } from "@/components/common/logo";
import { Card, CardContent } from "@/components/ui/card";
import { ApplicationForm } from "@/components/apply/application-form";

export const metadata: Metadata = { title: "Complete your application" };
export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo className="text-lg" />
        </div>
        <Card>
          <CardContent className="pt-6">{children}</CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          ROVE Technologies · This is a private application link.
        </p>
      </div>
    </div>
  );
}

function StateScreen({
  icon: Icon,
  tone,
  title,
  message,
}: {
  icon: typeof Clock;
  tone: "amber" | "slate" | "rose";
  title: string;
  message: string;
}) {
  const toneClass = {
    amber: "bg-amber-100 text-amber-600",
    slate: "bg-slate-100 text-slate-600",
    rose: "bg-rose-100 text-rose-600",
  }[tone];
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${toneClass}`}>
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default async function ApplyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await inspectToken(token);

  if (result.state === "expired") {
    return (
      <Shell>
        <StateScreen
          icon={Clock}
          tone="amber"
          title="This link has expired"
          message="Application links are valid for 14 days. Please contact the ROVE hiring team to request a new one."
        />
      </Shell>
    );
  }

  if (result.state === "used") {
    return (
      <Shell>
        <StateScreen
          icon={CheckCircle2}
          tone="slate"
          title="Application already submitted"
          message="This link has already been used to submit an application. There's nothing more to do here."
        />
      </Shell>
    );
  }

  if (result.state !== "valid" || !result.candidateId) {
    return (
      <Shell>
        <StateScreen
          icon={AlertCircle}
          tone="rose"
          title="This link is no longer active"
          message="The application link is invalid or has been deactivated. Please contact the ROVE hiring team."
        />
      </Shell>
    );
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: result.candidateId },
    include: { job: { select: { title: true } } },
  });
  if (!candidate) {
    return (
      <Shell>
        <StateScreen
          icon={AlertCircle}
          tone="rose"
          title="This link is no longer active"
          message="We couldn't find the associated application. Please contact the ROVE hiring team."
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-5 space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
          <LinkIcon className="h-3.5 w-3.5" /> Application
        </div>
        <h1 className="text-lg font-semibold tracking-tight">
          Complete your application
        </h1>
        <p className="text-sm text-muted-foreground">
          For <span className="font-medium text-foreground">{candidate.job.title}</span> at ROVE.
          Hi {candidate.name.split(" ")[0]}, just a few details to finish up.
        </p>
      </div>
      <ApplicationForm token={token} candidateName={candidate.name} />
    </Shell>
  );
}
