import * as React from "react";
import { cn } from "@/lib/utils";

export function SkeletonReveal({
  as = "span",
  children,
  className,
  skeleton,
}: {
  as?: "div" | "span";
  children: React.ReactNode;
  className?: string;
  skeleton: React.ReactNode;
}) {
  const Element = as;
  const Layer = as;
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
