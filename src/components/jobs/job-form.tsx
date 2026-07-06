"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { createJobAction, updateJobAction } from "@/server/actions/jobs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Markdown } from "@/components/common/markdown";
import { cn } from "@/lib/utils";

interface JobFormProps {
  mode: "create" | "edit";
  job?: {
    id: string;
    title: string;
    description: string;
    skills: string[];
    status: "OPEN" | "CLOSED";
  };
}

export function JobForm({ mode, job }: JobFormProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(job?.title ?? "");
  const [description, setDescription] = useState(job?.description ?? "");
  const [skills, setSkills] = useState<string[]>(job?.skills ?? []);
  const [skillDraft, setSkillDraft] = useState("");
  const [status, setStatus] = useState<"OPEN" | "CLOSED">(job?.status ?? "OPEN");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function addSkill() {
    const v = skillDraft.trim();
    if (v && !skills.includes(v)) setSkills([...skills, v]);
    setSkillDraft("");
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const input = { title, description, skills, status };
    start(async () => {
      const res =
        mode === "create"
          ? await createJobAction(input)
          : await updateJobAction(job!.id, input);
      if (res.ok) {
        toast.success(mode === "create" ? "Job opening created" : "Job opening updated");
        router.push(mode === "edit" && job ? `/jobs/${job.id}` : "/jobs");
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Senior Full-Stack Engineer"
        />
        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Description</Label>
          <div className="flex rounded-md border p-0.5 text-xs">
            {(["write", "preview"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "rounded px-2 py-0.5 capitalize transition-colors",
                  tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        {tab === "write" ? (
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Markdown supported — headings, lists, **bold**, links…"
            className="min-h-[220px] font-mono text-[13px]"
          />
        ) : (
          <div className="min-h-[220px] rounded-md border bg-muted/20 p-4">
            {description.trim() ? (
              <Markdown>{description}</Markdown>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
            )}
          </div>
        )}
        {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="skills">Required skills</Label>
        <div className="flex flex-wrap gap-1.5">
          {skills.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium"
            >
              {s}
              <button type="button" onClick={() => setSkills(skills.filter((x) => x !== s))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <Input
          id="skills"
          value={skillDraft}
          onChange={(e) => setSkillDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addSkill();
            }
          }}
          onBlur={addSkill}
          placeholder="Type a skill and press Enter"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Status</Label>
        <div className="flex gap-2">
          {(["OPEN", "CLOSED"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatus(st)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                status === st
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {st === "OPEN" ? "Open" : "Closed"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          {mode === "create" ? "Create opening" : "Save changes"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
