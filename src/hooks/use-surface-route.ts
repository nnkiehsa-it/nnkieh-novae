"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { compareRoutes, opensOverRoute } from "@/lib/route-hierarchy";

const DIRECTIONS = {
  deeper: "push",
  shallower: "pop",
  unrelated: "none",
} as const;

export type RouteDirection = (typeof DIRECTIONS)[keyof typeof DIRECTIONS];

/**
 * The route the page underneath belongs to, and how it got there.
 *
 * A record opened from the list it is in is shown over that list rather than
 * instead of it, so while it is open the page underneath is still the list: it
 * keeps its scroll, the pages it has loaded, and the navigation bar that points
 * at it. The address in the bar is the record's, which is the whole point of
 * opening it this way, so the one thing that must not read the address directly
 * is the shell -- it reads this instead, and stays where it is.
 *
 * Direction is derived from the two surfaces rather than tagged onto each link,
 * so every navigation resolves to the same push or pop regardless of what
 * triggered it: an in-app back control, the browser's Back and Forward buttons,
 * and the iOS edge swipe all arrive here the same way.
 */
export function useSurfaceRoute() {
  const pathname = usePathname();
  // The page that was on screen, kept the way React keeps information from a
  // previous render: adjusted during this one. The direction has to be on the
  // element in the same commit that starts its animation -- published
  // afterwards it would retune an animation that had already begun.
  const [shown, setShown] = React.useState<{
    direction: RouteDirection | null;
    path: string;
    surface: string;
  }>({ direction: null, path: pathname, surface: pathname });

  if (shown.path !== pathname) {
    const surface = opensOverRoute(shown.surface, pathname) ? shown.surface : pathname;
    setShown({
      direction:
        surface === shown.surface
          ? shown.direction
          : DIRECTIONS[compareRoutes(shown.surface, surface)],
      path: pathname,
      surface,
    });
  }

  // Updating state while rendering re-runs this at once, so what is answered is
  // always the state the commit will carry.
  return { direction: shown.direction, surface: shown.surface };
}
