"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { submitApplicationAction } from "@/server/actions/application";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS = [
  { name: "phone", label: "Phone number", type: "tel", placeholder: "+1 555 000 1234" },
  { name: "location", label: "Current location", type: "text", placeholder: "City, Country" },
  { name: "currentRole", label: "Current role", type: "text", placeholder: "e.g. Software Engineer at Acme" },
  { name: "noticePeriod", label: "Notice period", type: "text", placeholder: "e.g. 30 days" },
  { name: "salaryExpectation", label: "Salary expectation", type: "text", placeholder: "e.g. $130k or ₹28 LPA" },
  { name: "linkedinUrl", label: "LinkedIn URL", type: "url", placeholder: "https://linkedin.com/in/you" },
] as const;

export function ApplicationForm({ token, candidateName }: { token: string; candidateName: string }) {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const input = Object.fromEntries(FIELDS.map((field) => [field.name, String(f.get(field.name) ?? "")]));
    setErrors({});
    start(async () => {
      const res = await submitApplicationAction(token, input);
      if (res.ok) {
        setDone(true);
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </div>
        <h2 className="text-lg font-semibold">Thanks, {candidateName.split(" ")[0]}!</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your application has been submitted. The ROVE hiring team will be in touch with next
          steps. You can close this tab.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {FIELDS.map((field) => (
        <div key={field.name} className="space-y-1.5">
          <Label htmlFor={field.name}>{field.label}</Label>
          <Input id={field.name} name={field.name} type={field.type} placeholder={field.placeholder} />
          {errors[field.name] && <p className="text-xs text-destructive">{errors[field.name]}</p>}
        </div>
      ))}
      <Button type="submit" className="w-full" loading={pending}>
        Submit application
      </Button>
    </form>
  );
}
