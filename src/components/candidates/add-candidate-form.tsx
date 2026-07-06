"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, UploadCloud, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { createCandidateAction } from "@/server/actions/candidates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyButton } from "@/components/common/copy-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MAX_BYTES = 10 * 1024 * 1024;

interface OpenJob {
  id: string;
  title: string;
}

type Success = { candidateId: string; applyUrl: string; name: string };

export function AddCandidateForm({ openJobs }: { openJobs: OpenJob[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [jobId, setJobId] = useState<string>(openJobs[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<Success | null>(null);

  function pickFile(f: File | null) {
    if (!f) return setFile(null);
    if (f.type !== "application/pdf") {
      setErrors((e) => ({ ...e, resume: "Only PDF files are allowed." }));
      return;
    }
    if (f.size > MAX_BYTES) {
      setErrors((e) => ({ ...e, resume: "File exceeds the 10 MB limit." }));
      return;
    }
    setErrors((e) => ({ ...e, resume: "" }));
    setFile(f);
  }

  async function uploadResume(f: File): Promise<string> {
    const presignRes = await fetch("/api/uploads/resume-presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: f.name, contentType: "application/pdf", sizeBytes: f.size }),
    });
    if (!presignRes.ok) {
      const body = await presignRes.json().catch(() => ({}));
      throw new Error(body.error ?? "Could not prepare the upload.");
    }
    const { key, url, fields } = (await presignRes.json()) as {
      key: string;
      url: string;
      fields: Record<string, string>;
    };
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
    fd.append("file", f);
    const up = await fetch(url, { method: "POST", body: fd });
    if (!up.ok) throw new Error("Resume upload failed. Please try again.");
    return key;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    if (!file) {
      setErrors({ resume: "A resume PDF is required." });
      return;
    }
    start(async () => {
      try {
        const resumeKey = await uploadResume(file);
        const res = await createCandidateAction({
          name,
          email,
          jobId,
          resumeKey,
          fileName: file.name,
          sizeBytes: file.size,
        });
        if (res.ok && res.data) {
          setSuccess({ ...res.data, name });
          router.refresh();
        } else if (!res.ok) {
          setErrors(res.fieldErrors ?? {});
          toast.error(res.error);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  if (success) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-medium text-emerald-900">{success.name} added to the pipeline</p>
            <p className="text-sm text-emerald-800">
              Share the application link below so they can complete their details. It expires in 14
              days and can be used once.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Candidate application link</Label>
          <div className="flex gap-2">
            <Input readOnly value={success.applyUrl} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <CopyButton value={success.applyUrl} label="Copy link" />
          </div>
        </div>

        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/candidates/${success.candidateId}`}>
              View profile <ArrowRight />
            </Link>
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setSuccess(null);
              setName("");
              setEmail("");
              setFile(null);
            }}
          >
            Add another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Nair" />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="priya@example.com" />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Job opening</Label>
        <Select value={jobId} onValueChange={setJobId}>
          <SelectTrigger>
            <SelectValue placeholder="Select an open role" />
          </SelectTrigger>
          <SelectContent>
            {openJobs.map((j) => (
              <SelectItem key={j.id} value={j.id}>
                {j.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.jobId && <p className="text-xs text-destructive">{errors.jobId}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="resume">Resume (PDF, max 10 MB)</Label>
        <label
          htmlFor="resume"
          className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-4 transition-colors hover:border-primary/50 hover:bg-accent/30"
        >
          {file ? (
            <>
              <FileText className="h-5 w-5 text-primary" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </>
          ) : (
            <>
              <UploadCloud className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Click to select a PDF resume</span>
            </>
          )}
          <input
            id="resume"
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {errors.resume && <p className="text-xs text-destructive">{errors.resume}</p>}
      </div>

      <Button type="submit" loading={pending}>
        Add candidate
      </Button>
    </form>
  );
}
