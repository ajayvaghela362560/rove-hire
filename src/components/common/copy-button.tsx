"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  label = "Copy",
  className,
  size = "sm",
  variant = "outline",
}: {
  value: string;
  label?: string;
  className?: string;
  size?: "sm" | "default" | "icon";
  variant?: "outline" | "secondary" | "ghost" | "default";
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy — please copy manually");
    }
  }

  return (
    <Button type="button" variant={variant} size={size} onClick={copy} className={cn(className)}>
      {copied ? <Check className="text-emerald-600" /> : <Copy />}
      {size !== "icon" && (copied ? "Copied" : label)}
    </Button>
  );
}
