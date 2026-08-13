"use client";

import * as React from "react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const STAGGER_SETTLE_MS = 520;
const visibilityCallbacks = new WeakMap<Element, (visible: boolean) => void>();
let visibilityObserver: IntersectionObserver | null = null;

function getVisibilityObserver() {
  if (visibilityObserver || typeof IntersectionObserver === "undefined")
    return visibilityObserver;
  visibilityObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        visibilityCallbacks.get(entry.target)?.(entry.isIntersecting);
    },
    { rootMargin: "32px 0px", threshold: 0.01 },
  );
  return visibilityObserver;
}

export function StaggerList({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("t-stagger-list", className)} {...props} />;
}

export function StaggerItem({ className, ...props }: ComponentProps<"div">) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [observed, setObserved] = React.useState(false);
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const node = ref.current;
    const observer = getVisibilityObserver();
    if (!node || !observer) return;
    visibilityCallbacks.set(node, setVisible);
    observer.observe(node);
    const settle = window.setTimeout(() => setObserved(true), STAGGER_SETTLE_MS);
    return () => {
      window.clearTimeout(settle);
      observer.unobserve(node);
      visibilityCallbacks.delete(node);
    };
  }, []);

  return (
    <div
      className={cn("t-stagger-item", className)}
      data-observed={observed}
      data-visible={visible}
      ref={ref}
      {...props}
    />
  );
}
