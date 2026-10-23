import { Toaster as Sonner } from "sonner";
import { cn } from "@/lib/utils";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn("inline-block size-5 shrink-0 animate-spin rounded-full border-2 border-ink-faint border-t-ink [animation-duration:var(--motion-spin)]", className)}
      role={label ? "status" : undefined}
    />
  );
}

/** Space held for content that is still loading. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("skeleton block rounded-tile bg-surface-raised", className)} />;
}

/** Determinate progress, such as an upload. */
export function ProgressBar({ className, label, value }: { className?: string; label: string; value: number }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div aria-label={label} aria-valuemax={100} aria-valuemin={0} aria-valuenow={percent} className={cn("h-1.5 overflow-hidden rounded-full bg-surface-raised", className)} role="progressbar">
      <div className="h-full rounded-full bg-contrast transition-[width] duration-[var(--motion-control)] ease-[var(--ease-move)]" style={{ width: `${percent}%` }} />
    </div>
  );
}

const toastClassNames = {
  toast: "glass !rounded-full !border-line !bg-[var(--surface)] !text-ink !shadow-float",
  // Sonner names the secondary line `description`; this is a class list, not copy.
  ["description"]: "!text-ink-muted",
};

export function Toaster() {
  return (
    <Sonner
      mobileOffset={{ bottom: "calc(var(--bottom-nav-height) + var(--bottom-nav-gap) + 0.75rem)" }}
      position="bottom-center"
      theme="dark"
      toastOptions={{ classNames: toastClassNames }}
    />
  );
}
