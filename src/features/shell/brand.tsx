import { AppLink } from "@/ui/app-link";
import { cn } from "@/lib/utils";

/** The Novae wave, drawn in the current text colour so it sits on any surface. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-tile bg-surface text-ink shadow-panel", className)}>
      <svg className="w-3/5" fill="none" viewBox="0 0 120 100">
        <path
          d="M 10 79 C 18 65, 23 43, 26 23 C 29 14, 37 14, 41 23 C 50 44, 60 63, 72 80 C 77 87, 85 85, 86 75 C 88 55, 91 34, 98 21 C 102 14, 109 16, 110 26"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="7"
        />
      </svg>
    </span>
  );
}

export function BrandLockup({ className, href, markClassName }: { className?: string; href?: string; markClassName?: string }) {
  const content = (
    <>
      <BrandMark className={markClassName} />
      <span className="text-lg font-semibold tracking-tight">Novae</span>
    </>
  );
  const classes = cn("flex items-center gap-3", className);
  return href ? (
    <AppLink className={cn(classes, "rounded-tile outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]")} href={href}>
      {content}
    </AppLink>
  ) : (
    <div className={classes}>{content}</div>
  );
}
