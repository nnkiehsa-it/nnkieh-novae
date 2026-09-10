"use client";

import { ViewTransition, useLayoutEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { compareRoutes } from "@/lib/route-hierarchy";
import { cn } from "@/lib/utils";

const DIRECTIONS = {
  deeper: "push",
  shallower: "pop",
  unrelated: "none",
} as const;

export function RouteSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const previous = useRef(pathname);

  // Direction is derived from the two URLs instead of tagged onto each link, so
  // every navigation resolves to the same push or pop regardless of what
  // triggered it. Note that Next deliberately dispatches a history traversal
  // outside a React Transition to keep Back instant, so a traversal currently
  // commits with no view transition to animate; the direction it reports is
  // still correct, and the recipes apply as soon as that changes.
  //
  // It is published on the document rather than passed to <ViewTransition>
  // because the surface that leaves keeps the props it last rendered with,
  // which predate this navigation. React runs layout effects inside the view
  // transition's update callback, so the attribute is in place before the
  // browser captures the new snapshot and starts the animations.
  useLayoutEffect(() => {
    document.documentElement.dataset.navDirection =
      DIRECTIONS[compareRoutes(previous.current, pathname)];
    previous.current = pathname;
  }, [pathname]);

  return (
    <ViewTransition
      default="none"
      enter="t-route-in"
      exit="t-route-out"
      key={pathname}
    >
      <div className={cn("route-page", className)} data-route-path={pathname}>
        {children}
      </div>
    </ViewTransition>
  );
}
