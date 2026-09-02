import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "t-input flex field-sizing-content min-h-28 w-full rounded-xl border border-input bg-card px-3.5 py-3 text-base shadow-[var(--shadow-control)] transition-[background-color,color,border-color,box-shadow,transform] duration-[var(--motion-quick)] ease-[var(--ease-smooth-out)] outline-none placeholder:text-muted-foreground hover:border-foreground/12 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 selection:bg-[var(--selection-bg)] selection:text-[var(--selection-fg)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
