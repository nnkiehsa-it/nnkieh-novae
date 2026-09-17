"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { usePathname } from "next/navigation";

import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  interactiveTarget,
  internalAnchor,
  isDisabledTarget,
} from "@/lib/interactive-target";
import { opensOverRoute } from "@/lib/route-hierarchy";

interface PendingDetailNavigation {
  pathname: string;
  sourcePathname: string;
  sourceScrollY: number;
}

interface OptimisticDetailNavigationValue {
  claim: (pathname: string) => void;
  pendingPathname: string | null;
}

const OptimisticDetailNavigation =
  React.createContext<OptimisticDetailNavigationValue | null>(null);

export function OptimisticDetailNavigationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [pending, setPending] = React.useState<PendingDetailNavigation | null>(
    null,
  );

  React.useEffect(() => {
    let pointerSource: { anchor: HTMLAnchorElement; scrollY: number } | null = null;

    const onPointerDown = (event: PointerEvent) => {
      const target = interactiveTarget(event.target);
      const anchor = target && !isDisabledTarget(target) ? internalAnchor(target) : null;
      if (!anchor) {
        pointerSource = null;
        return;
      }
      const destination = new URL(anchor.href, window.location.href);
      pointerSource = opensOverRoute(pathname, destination.pathname)
        ? { anchor, scrollY: window.scrollY }
        : null;
    };

    const onClick = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = interactiveTarget(event.target);
      if (!target || isDisabledTarget(target)) return;
      const anchor = internalAnchor(target);
      if (!anchor) return;
      const destination = new URL(anchor.href, window.location.href);
      if (!opensOverRoute(pathname, destination.pathname)) return;
      const sourceScrollY = pointerSource?.anchor === anchor
        ? pointerSource.scrollY
        : window.scrollY;
      pointerSource = null;

      flushSync(() => {
        setPending({
          pathname: destination.pathname,
          sourcePathname: pathname,
          sourceScrollY,
        });
      });
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [pathname]);

  React.useEffect(() => {
    if (!pending) return;
    if (
      pathname !== pending.sourcePathname &&
      pathname !== pending.pathname
    ) {
      setPending(null);
      return;
    }
    const timeout = window.setTimeout(() => setPending(null), 12_000);
    return () => window.clearTimeout(timeout);
  }, [pathname, pending]);

  const claim = React.useCallback((claimedPathname: string) => {
    setPending((current) =>
      current?.pathname === claimedPathname ? null : current,
    );
  }, []);

  const value = React.useMemo<OptimisticDetailNavigationValue>(
    () => ({ claim, pendingPathname: pending?.pathname ?? null }),
    [claim, pending?.pathname],
  );

  return (
    <OptimisticDetailNavigation.Provider value={value}>
      {children}
      {pending ? (
        <Sheet open onOpenChange={() => undefined}>
          <SheetContent
            className="grid-rows-[minmax(0,1fr)]"
            stageScrollY={pending.sourceScrollY}
          >
            <SheetBody className="pb-0">
              <SheetTitle className="sr-only">Novae</SheetTitle>
            </SheetBody>
          </SheetContent>
        </Sheet>
      ) : null}
    </OptimisticDetailNavigation.Provider>
  );
}

export function useOptimisticDetailHandoff(pathname: string) {
  const navigation = React.useContext(OptimisticDetailNavigation);
  const handoff = navigation?.pendingPathname === pathname;

  React.useLayoutEffect(() => {
    if (handoff) navigation?.claim(pathname);
  }, [handoff, navigation, pathname]);

  return handoff;
}
