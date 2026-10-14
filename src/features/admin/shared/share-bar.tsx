import { Skeleton } from "@/ui/feedback";

interface ShareSegment {
  count: number;
  key: string;
  label: string;
}

/** Each step down the ranking is a paler shade of the same white. */
function shadeOf(rank: number) {
  return Math.max(0.3, 1 - rank * 0.16);
}

/**
 * How a whole is spread across its parts: one bar whose widths are the shares,
 * and the figures underneath. The bar is the picture and the figures are the
 * record, so the bar is hidden from assistive technology rather than described twice.
 */
export function ShareBar({ label, loading = false, segments }: {
  label: string;
  loading?: boolean;
  segments: readonly ShareSegment[];
}) {
  const present = segments.filter((segment) => segment.count > 0);
  if (loading) return <div className="grid gap-3"><Skeleton className="h-2 w-full rounded-full" /><Skeleton className="h-4 w-48" /></div>;
  if (present.length === 0) return null;
  return (
    <section aria-label={label} className="grid gap-3">
      <div aria-hidden className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface-raised">
        {present.map((segment, rank) => (
          <span
            className="h-full min-w-1.5 rounded-full bg-contrast transition-[flex-grow] duration-[var(--motion-control)] ease-[var(--ease-move)]"
            key={segment.key}
            style={{ flexGrow: segment.count, opacity: shadeOf(rank) }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {present.map((segment, rank) => (
          <li className="flex items-center gap-2 text-sm" key={segment.key}>
            <span aria-hidden className="size-2 rounded-full bg-contrast" style={{ opacity: shadeOf(rank) }} />
            <span className="font-semibold tabular-nums">{segment.count}</span>
            <span className="text-ink-muted">{segment.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
