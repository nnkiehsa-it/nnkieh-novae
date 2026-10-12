"use client";

import { Toaster as Sonner } from "sonner";
import { cn } from "@/lib/utils";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span
      aria-label={label}
      className={cn("inline-block size-5 animate-spin rounded-full border-2 border-ink-faint border-t-ink [animation-duration:var(--motion-spin)]", className)}
      role={label ? "status" : undefined}
    />
  );
}

/** Space held for content that is still loading. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block animate-pulse rounded-tile bg-surface-raised [animation-duration:var(--motion-pulse)]", className)} />;
}

const toastClassNames = {
  toast: "glass !rounded-full !border-line !bg-[var(--surface)] !text-ink !shadow-float",
  // Sonner names the secondary line `description`; this is a class list, not copy.
  ["description"]: "!text-ink-muted",
};

export function Toaster() {
  return (
    <Sonner
      offset="calc(var(--bottom-nav-height) + var(--bottom-nav-gap) + 0.75rem)"
      position="bottom-center"
      theme="dark"
      toastOptions={{ classNames: toastClassNames }}
    />
  );
}
