"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AddCandidateForm } from "./add-candidate-form";

interface OpenJob {
  id: string;
  title: string;
}

export function AddCandidateDialog({
  openJobs,
  trigger,
}: {
  openJobs: OpenJob[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus /> Add Candidate
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add candidate</DialogTitle>
          <DialogDescription>
            Upload a resume, pick the role, and generate an application link.
          </DialogDescription>
        </DialogHeader>
        {openJobs.length === 0 ? (
          <div className="space-y-3 py-2 text-sm text-muted-foreground">
            <p>You need at least one open job opening before adding a candidate.</p>
            <Button asChild size="sm" variant="outline" onClick={() => setOpen(false)}>
              <Link href="/jobs/new">Create an opening</Link>
            </Button>
          </div>
        ) : (
          <AddCandidateForm openJobs={openJobs} />
        )}
      </DialogContent>
    </Dialog>
  );
}
