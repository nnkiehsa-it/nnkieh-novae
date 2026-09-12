"use client";

import { ViewTransition, useLayoutEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { compareRoutes, isPrimaryRoute } from "@/lib/route-hierarchy";
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
  const surface = useRef<HTMLDivElement>(null);

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
    const direction = DIRECTIONS[compareRoutes(previous.current, pathname)];
    document.documentElement.dataset.navDirection = direction;
    if (
      surface.current &&
      previous.current !== pathname &&
      direction === "none"
    ) {
      surface.current.dataset.routeEntry = "replace";
    }
    previous.current = pathname;
  }, [pathname]);

  const content = (
    <div
      ref={surface}
      key={pathname}
      className={cn("route-page", className)}
      data-route-path={pathname}
    >
      {children}
    </div>
  );

  // Primary pages never enter the document snapshot lifecycle: even a disabled
  // boundary briefly suspends hit testing while React prepares its capture.
  if (isPrimaryRoute(pathname)) return content;

  return (
    <ViewTransition
      default="none"
      enter="t-route-in"
      exit="t-route-out"
      key={pathname}
    >
      {content}
    </ViewTransition>
  );
}
