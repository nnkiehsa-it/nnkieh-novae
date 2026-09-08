"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
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
  const surface = useRef<HTMLDivElement>(null);
  const previousPath = useRef(pathname);
  useLayoutEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = surface.current?.animate([{ opacity: 0.85 }, { opacity: 1 }], {
      duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    });
    if (animation) animation.id = "novae-route-enter";
    return () => animation?.cancel();
  }, [pathname]);

  return (
    <div
      className={cn("route-page t-route-page-enter", className)}
      data-route-path={pathname}
      ref={surface}
    >
      {children}
    </div>
  );
}
