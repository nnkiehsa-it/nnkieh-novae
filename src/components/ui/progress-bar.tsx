import { cn } from "@/lib/utils";

/**
 * How far along something is, as one line.
 *
 * Background work reports its progress in two places -- under a save that
 * handed work to the background, and in the operations screen's list of running
 * jobs -- and both of them draw the same line, so the line is one component.
 * The fill is scaled rather than sized, so the movement is the browser's own
 * and never reflows the row it sits in.
 */
export function ProgressBar({
  className,
  label,
  percent,
}: {
  className?: string;
  label: string;
  percent: number;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={clamped}
      className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
    >
      <div
        className="h-full origin-left rounded-full bg-primary transition-transform duration-[var(--motion-sheet)]"
        style={{ transform: `scaleX(${clamped / 100})` }}
      />
    </div>
  );
}
