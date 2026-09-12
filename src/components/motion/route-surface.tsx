"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { compareRoutes } from "@/lib/route-hierarchy";
import { cn } from "@/lib/utils";

const DIRECTIONS = {
  deeper: "push",
  shallower: "pop",
  unrelated: "none",
} as const;

/**
 * The surface every route is painted on.
 *
 * Only the page that arrives animates, and it animates in the live document.
 * Capturing the document instead — a view transition — buys the page being left
 * a parallax, and costs a full rasterisation of both pages at the moment the
 * browser is already fetching, rendering and hydrating the route that was asked
 * for. It also suspends hit testing for the length of the animation, which is
 * what used to swallow a tap on the dock.
 *
 * Direction is derived from the two URLs rather than tagged onto each link, so
 * every navigation resolves to the same push or pop regardless of what
 * triggered it: an in-app back control, the browser's Back and Forward buttons,
 * and the iOS edge swipe all arrive here the same way.
 */
export function RouteSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  // The page that was on screen, kept the way React keeps information from a
  // previous render: adjusted during this one. The direction has to be on the
  // element in the same commit that starts its animation — published afterwards
  // it would retune an animation that had already begun.
  const [shown, setShown] = useState({ from: "", path: pathname });
  if (shown.path !== pathname) setShown({ from: shown.path, path: pathname });
  const direction = shown.from
    ? DIRECTIONS[compareRoutes(shown.from, pathname)]
    : null;

  return (
    // The first page of a session has no direction and no entrance: it arrived
    // with the document, and animating it would make the app look like it was
    // still assembling itself.
    <div
      key={pathname}
      className={cn("route-page", className)}
      data-route-direction={direction ?? undefined}
      data-route-path={pathname}
    >
      {children}
    </div>
  );
}
