import { cn } from "@/lib/utils";

/** ROVE Hire wordmark — matches the letterhead used in the generated PDFs. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-1.5 font-semibold tracking-tight", className)}>
      <span className="text-foreground">ROVE</span>
      <span className="rounded bg-primary px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground">
        Hire
      </span>
    </span>
  );
}
