"use client";

import type { ComponentProps, ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { timing } from "@/lib/motion-timing";
import { cn } from "@/lib/utils";

export function StateTransition({
  children,
  className,
  identity,
  ...props
}: {
  children: ReactNode;
  className?: string;
  identity: string;
} & Omit<ComponentProps<"div">, "children">) {
  return (
    <div
      className={cn("t-state-transition", className)}
      data-resize-motion=""
      data-state-transition={identity}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Crossfades one state of a container for the next, in place.
 *
 * It never animates its own first render. Content that is on screen because its
 * route just arrived is already being carried by the route transition, and
 * fading it in again underneath that is what made an ordinary navigation read
 * as a reload. Only a real change of identity animates: a skeleton handing off
 * to content, or one entity replacing another in a frame the user is watching.
 */
export function ContentTransition({
  children,
  className,
  identity,
}: {
  children: ReactNode;
  className?: string;
  identity: string;
}) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div
        animate={{ opacity: 1 }}
        className={cn("t-state-content", className)}
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        key={identity}
        transition={timing("control", "move")}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
