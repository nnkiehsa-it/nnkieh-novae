"use client";

import { ViewTransition, type ReactNode } from "react";
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
    <ViewTransition
      key={pathname}
      name="novae-route-content"
      share="novae-route-swap"
      enter="novae-route-enter"
      exit="novae-route-exit"
      default="none"
    >
      <div className={cn("route-page", className)} data-route-path={pathname}>
        {children}
      </div>
    </ViewTransition>
  );
}
