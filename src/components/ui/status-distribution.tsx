import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface StatusSegment {
  color: string;
  count: number;
  fill: string;
  key: string;
  label: string;
}

/**
 * How a whole category is spread across its states: one bar whose widths are the
 * shares, and the figures underneath. The bar is the picture, the figures are the
 * record, so the bar is hidden from assistive technology rather than described twice.
 */
export function StatusDistribution({
  ariaLabel,
  loading = false,
  segments,
}: {
  ariaLabel: string;
  loading?: boolean;
  segments: readonly StatusSegment[];
}) {
  const filled = segments.filter((segment) => segment.count > 0);
  const total = filled.reduce((sum, segment) => sum + segment.count, 0);
  if (loading && total === 0) {
    return (
      <div className="grid gap-2.5 px-0.5">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <Skeleton className="h-3.5 w-48" />
      </div>
    );
  }
  if (total === 0) return null;
  return (
    <section aria-label={ariaLabel} className="grid gap-2.5 px-0.5">
      {/* One state holding everything is not a distribution, and a bar that is all one
          colour says less than the figure beneath it already does. */}
      {filled.length > 1 ? (
        <div aria-hidden className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-muted">
          {filled.map((segment) => (
            <span
              className="h-full min-w-1.5 rounded-full transition-[flex-grow] duration-[var(--motion-control)] ease-[var(--ease-move)]"
              key={segment.key}
              style={{ backgroundColor: segment.fill, flexGrow: segment.count }}
            />
          ))}
        </div>
      ) : null}
      <ul className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {segments.map((segment) => (
          <li className="flex items-baseline gap-1.5" key={segment.key}>
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                segment.count === 0 && "text-muted-foreground/70",
              )}
              style={segment.count > 0 ? { color: segment.color } : undefined}
            >
              {segment.count}
            </span>
            <span className="text-xs text-muted-foreground">{segment.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
