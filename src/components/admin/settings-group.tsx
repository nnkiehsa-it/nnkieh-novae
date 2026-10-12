"use client";

import { ChevronDown } from "lucide-react";
import * as React from "react";

/** Native disclosure keeps long settings pages scannable and keyboard friendly. */
export function SettingsGroup({
  children,
  defaultOpen = false,
  title,
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
  title: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <details className="group" onToggle={(event) => setOpen(event.currentTarget.open)} open={open}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-1 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="pt-2">{children}</div>
    </details>
  );
}
