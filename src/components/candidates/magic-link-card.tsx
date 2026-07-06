"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Link2 } from "lucide-react";
import { toast } from "sonner";
import { regenerateMagicLinkAction } from "@/server/actions/candidates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/common/copy-button";

/**
 * Only the token hash is stored, so a previously-issued link can't be re-shown.
 * HR regenerates a fresh single-use link here (also the recovery path if one expired).
 */
export function MagicLinkCard({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);

  function regenerate() {
    start(async () => {
      const res = await regenerateMagicLinkAction(candidateId);
      if (res.ok && res.data) {
        setLink(res.data.applyUrl);
        toast.success("New application link generated");
        router.refresh();
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        Application link
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Share this single-use link so the candidate can complete their details. It expires in 14
        days. For security, an issued link can&apos;t be shown again — generate a fresh one below.
      </p>
      {link ? (
        <div className="mt-3 flex gap-2">
          <Input readOnly value={link} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <CopyButton value={link} label="Copy" />
        </div>
      ) : (
        <Button variant="outline" size="sm" className="mt-3" onClick={regenerate} loading={pending}>
          <RefreshCw /> Generate link
        </Button>
      )}
    </div>
  );
}
