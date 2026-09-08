"use client";

import type { ReactNode } from "react";

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
      className={className}
      data-resize-motion=""
      data-state-transition={identity}
    >
      {children}
    </div>
  );
}
