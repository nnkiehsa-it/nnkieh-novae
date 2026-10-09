import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "input novae-input flex field-sizing-content min-h-28 w-full border border-border px-4 py-3 text-base outline-none placeholder:text-muted-foreground selection:bg-[var(--selection-bg)] selection:text-[var(--selection-fg)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
