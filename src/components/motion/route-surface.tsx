"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function RouteSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <div
      className={cn("route-page t-route-page-enter", className)}
      data-route-path={pathname}
      key={pathname}
    >
      {children}
    </div>
  );
}
