"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  const element = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // A shared document clock keeps all placeholders in the same pulse phase,
    // including those arriving in a streamed/preloaded route.
    element.current?.getAnimations({ subtree: true }).forEach((animation) => {
      animation.startTime = 0;
    });
  }, []);
  return (
    <div
      ref={element}
      data-slot="skeleton"
      className={cn("t-skeleton rounded-md bg-muted/55", className)}
      {...props}
    />
  );
}

export { Skeleton };
