import {
  UserPlus,
  FileCheck,
  Link2,
  CalendarClock,
  MessageSquare,
  FileSignature,
  CheckCircle2,
  XCircle,
  Circle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TimelineEvent, TimelineEventType } from "@prisma/client";
import { VERDICT_META, INTERVIEW_TYPE_LABEL } from "@/lib/status";
import { formatDateTime } from "@/lib/utils";

const ICONS: Record<TimelineEventType, LucideIcon> = {
  CANDIDATE_CREATED: UserPlus,
  FORM_SUBMITTED: FileCheck,
  LINK_REGENERATED: Link2,
  INTERVIEW_SCHEDULED: CalendarClock,
  INTERVIEW_COMPLETED: CheckCircle2,
  FEEDBACK_RECORDED: MessageSquare,
  OFFER_GENERATED: FileSignature,
  HIRED: CheckCircle2,
  REJECTED: XCircle,
};

function describe(event: TimelineEvent): { title: string; detail?: string } {
  const p = (event.payload ?? {}) as Record<string, unknown>;
  switch (event.type) {
    case "CANDIDATE_CREATED":
      return { title: "Candidate added", detail: p.jobTitle ? `Applied for ${p.jobTitle}` : undefined };
    case "FORM_SUBMITTED":
      return { title: "Application form submitted", detail: "Completed by the candidate" };
    case "LINK_REGENERATED":
      return { title: "Application link regenerated" };
    case "INTERVIEW_SCHEDULED": {
      const type = p.type ? INTERVIEW_TYPE_LABEL[p.type as keyof typeof INTERVIEW_TYPE_LABEL] : "";
      const who = p.interviewer ? ` with ${p.interviewer}` : "";
      return { title: `${type} interview scheduled`.trim(), detail: who ? who.trim() : undefined };
    }
    case "INTERVIEW_COMPLETED":
      return { title: "Interview completed" };
    case "FEEDBACK_RECORDED": {
      const verdict = p.verdict as keyof typeof VERDICT_META | undefined;
      return {
        title: "Interview feedback recorded",
        detail: verdict ? `Recommendation: ${VERDICT_META[verdict].label}` : undefined,
      };
    }
    case "OFFER_GENERATED":
      return {
        title: "Offer documents generated",
        detail: p.roleTitle ? `${p.roleTitle}${p.salaryLabel ? ` · ${p.salaryLabel}` : ""}` : undefined,
      };
    case "HIRED":
      return { title: "Marked as hired" };
    case "REJECTED":
      return { title: "Candidate rejected", detail: p.reason ? String(p.reason) : undefined };
    default:
      return { title: event.type };
  }
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }
  return (
    <ol className="relative space-y-5 before:absolute before:left-[15px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
      {events.map((event) => {
        const Icon = ICONS[event.type] ?? Circle;
        const { title, detail } = describe(event);
        return (
          <li key={event.id} className="relative flex gap-3">
            <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground">
              <Icon className="h-4 w-4" />
            </span>
            <div className="pt-1">
              <p className="text-sm font-medium leading-tight">{title}</p>
              {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
              <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
