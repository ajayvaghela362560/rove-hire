"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, FileSignature, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { CandidateStatus } from "@prisma/client";
import { allowedActions } from "@/server/domain/transitions";
import { scheduleInterviewAction } from "@/server/actions/interviews";
import { generateOfferDocumentsAction } from "@/server/actions/offers";
import { markHiredAction, markRejectedAction } from "@/server/actions/lifecycle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES } from "@/lib/validation/schemas";

interface Props {
  candidateId: string;
  status: CandidateStatus;
  defaultRole: string;
  defaultLocation?: string;
  hasOffer: boolean;
  hasCompletedInterview: boolean;
}

export function CandidateActions(props: Props) {
  const actions = allowedActions(props.status, {
    hasOffer: props.hasOffer,
    hasCompletedInterview: props.hasCompletedInterview,
  });

  return (
    <div className="flex flex-wrap gap-2">
      {actions.includes("SCHEDULE_INTERVIEW") && <ScheduleInterviewDialog candidateId={props.candidateId} />}
      {actions.includes("GENERATE_OFFER") && (
        <GenerateOfferDialog
          candidateId={props.candidateId}
          defaultRole={props.defaultRole}
          defaultLocation={props.defaultLocation}
          hasCompletedInterview={props.hasCompletedInterview}
          alreadySent={props.status === "OFFER_SENT"}
        />
      )}
      {actions.includes("MARK_HIRED") && <MarkHiredDialog candidateId={props.candidateId} />}
      {actions.includes("REJECT") && <RejectDialog candidateId={props.candidateId} />}
    </div>
  );
}

function useRefreshTransition() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return { pending, start, router };
}

function ScheduleInterviewDialog({ candidateId }: { candidateId: string }) {
  const { pending, start, router } = useRefreshTransition();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const input = {
      date: String(f.get("date") ?? ""),
      time: String(f.get("time") ?? ""),
      type: String(f.get("type") ?? "SCREENING"),
      interviewerName: String(f.get("interviewerName") ?? ""),
      notes: String(f.get("notes") ?? ""),
    };
    setErrors({});
    start(async () => {
      const res = await scheduleInterviewAction(candidateId, input);
      if (res.ok) {
        toast.success("Interview scheduled");
        setOpen(false);
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarPlus /> Schedule interview
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Schedule interview</DialogTitle>
            <DialogDescription>Set a date, type, and interviewer.</DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="date">Date</Label>
                <Input id="date" name="date" type="date" required />
                {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="time">Time</Label>
                <Input id="time" name="time" type="time" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <TypeSelect />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interviewerName">Interviewer</Label>
              <Input id="interviewerName" name="interviewerName" placeholder="e.g. Jordan Avery" />
              {errors.interviewerName && <p className="text-xs text-destructive">{errors.interviewerName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" name="notes" placeholder="Anything the interviewer should know…" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Schedule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TypeSelect() {
  const [value, setValue] = useState("SCREENING");
  return (
    <>
      <input type="hidden" name="type" value={value} />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="SCREENING">Screening</SelectItem>
          <SelectItem value="TECHNICAL">Technical</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}

function GenerateOfferDialog({
  candidateId,
  defaultRole,
  defaultLocation,
  hasCompletedInterview,
  alreadySent,
}: {
  candidateId: string;
  defaultRole: string;
  defaultLocation?: string;
  hasCompletedInterview: boolean;
  alreadySent: boolean;
}) {
  const { pending, start, router } = useRefreshTransition();
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState<string>("USD");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const input = {
      roleTitle: String(f.get("roleTitle") ?? ""),
      salaryCurrency: currency,
      salaryAmount: Number(f.get("salaryAmount") ?? 0),
      startDate: String(f.get("startDate") ?? ""),
      reportingManager: String(f.get("reportingManager") ?? ""),
      location: String(f.get("location") ?? ""),
    };
    setErrors({});
    start(async () => {
      const res = await generateOfferDocumentsAction(candidateId, input);
      if (res.ok) {
        toast.success("Offer Letter and NDA generated");
        setOpen(false);
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <FileSignature /> {alreadySent ? "Regenerate offer" : "Generate Offer Documents"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Generate offer documents</DialogTitle>
            <DialogDescription>
              Produces a downloadable Offer Letter and NDA, and moves the candidate to Offer Sent.
            </DialogDescription>
          </DialogHeader>

          {!hasCompletedInterview && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              No completed interview with feedback yet. You can still proceed, but it&apos;s usually
              done after an interview.
            </div>
          )}

          <div className="my-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="roleTitle">Role title</Label>
              <Input id="roleTitle" name="roleTitle" defaultValue={defaultRole} />
              {errors.roleTitle && <p className="text-xs text-destructive">{errors.roleTitle}</p>}
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-3">
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="salaryAmount">Annual amount</Label>
                <Input id="salaryAmount" name="salaryAmount" type="number" min="1" step="1000" placeholder="145000" />
                {errors.salaryAmount && <p className="text-xs text-destructive">{errors.salaryAmount}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Start date</Label>
                <Input id="startDate" name="startDate" type="date" />
                {errors.startDate && <p className="text-xs text-destructive">{errors.startDate}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reportingManager">Reporting manager</Label>
                <Input id="reportingManager" name="reportingManager" placeholder="Jordan Avery" />
                {errors.reportingManager && <p className="text-xs text-destructive">{errors.reportingManager}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Work location</Label>
              <Input id="location" name="location" defaultValue={defaultLocation} placeholder="San Francisco, CA (Hybrid)" />
              {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Generate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MarkHiredDialog({ candidateId }: { candidateId: string }) {
  const { pending, start, router } = useRefreshTransition();
  const [open, setOpen] = useState(false);

  function confirm() {
    start(async () => {
      const res = await markHiredAction(candidateId);
      if (res.ok) {
        toast.success("Candidate marked as hired 🎉");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
          <CheckCircle2 /> Mark hired
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as hired?</DialogTitle>
          <DialogDescription>
            This moves the candidate to the Hired state. This is a terminal status and cannot be changed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={confirm} loading={pending} className="bg-emerald-600 hover:bg-emerald-700">
            Confirm hire
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({ candidateId }: { candidateId: string }) {
  const { pending, start, router } = useRefreshTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get("reason") ?? "");
    setError("");
    start(async () => {
      const res = await markRejectedAction(candidateId, { reason });
      if (res.ok) {
        toast.success("Candidate rejected");
        setOpen(false);
        router.refresh();
      } else {
        setError(res.fieldErrors?.reason ?? res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
          <XCircle /> Reject
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Reject candidate</DialogTitle>
            <DialogDescription>Record a short reason. This is logged in the timeline.</DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <Textarea id="reason" name="reason" placeholder="e.g. Strong profile, but we moved forward with another candidate." required />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" loading={pending}>
              Reject candidate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
