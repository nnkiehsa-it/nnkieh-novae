"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StateTransition({
  children,
  className,
  identity,
}: {
  children: ReactNode;
  className?: string;
  identity: string;
}) {
  return (
    <div
      className={cn("t-resize", className)}
      data-state-transition={identity}
    >
      {children}
    </div>
  );
}
