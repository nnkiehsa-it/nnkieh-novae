import * as React from "react";
import { cn } from "@/lib/utils";

export function SkeletonReveal({
  as = "span",
  children,
  className,
  enabled = true,
  skeleton,
}: {
  as?: "div" | "span";
  children: React.ReactNode;
  className?: string;
  enabled?: boolean;
  skeleton: React.ReactNode;
}) {
  const Element = as;
  const Layer = as;
  if (!enabled) return <Element className={className}>{children}</Element>;
  return (
    <Element
      className={cn("t-skel is-revealed", className)}
      data-block={as === "div" ? "true" : undefined}
    >
      <Layer aria-hidden className="t-skel-skeleton is-pulsing">
        {skeleton}
      </Layer>
      <Layer className="t-skel-content">{children}</Layer>
    </Element>
  );
}
