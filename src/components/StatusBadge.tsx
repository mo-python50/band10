import { cn } from "@/lib/utils";
import { STATUS_LABEL, type EvaluationStatus } from "@/lib/types";

const styles: Record<EvaluationStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  active: "bg-success/12 text-success border-success/30",
  paused: "bg-warning/15 text-foreground border-warning/40",
  completed: "bg-primary/10 text-primary border-primary/25",
  archived: "bg-secondary text-secondary-foreground border-border",
};

export function StatusBadge({ status, className }: { status: EvaluationStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", styles[status], className)}>
      {status === "active" && <span className="size-1.5 animate-pulse rounded-full bg-success" />}
      {STATUS_LABEL[status]}
    </span>
  );
}
