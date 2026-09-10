"use client";

import type { ComponentProps, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export function StaggerList({
  children,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children"> & { children: ReactNode }) {
  return (
    <div className={cn("t-stagger-list relative", className)} {...props}>
      <AnimatePresence>
        {children}
      </AnimatePresence>
    </div>
  );
}

// List entry and exit is an opacity handoff on the --motion-content rung.
// Blurring or displacing each row made an ordinary re-render read as a reload.
export function StaggerItem({ className, initial, ...props }: ComponentProps<typeof motion.div>) {
  const reduced = useReducedMotion();
  const defaultInitial = reduced ? false : { opacity: 0 };
  return (
    <motion.div
      className={cn("t-stagger-item", className)}
      initial={initial !== undefined ? initial : defaultInitial}
      animate={{ opacity: 1 }}
      exit={reduced ? undefined : { opacity: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      {...props}
    />
  );
}
