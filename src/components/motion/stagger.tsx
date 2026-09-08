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

export function StaggerItem({ className, initial, ...props }: ComponentProps<typeof motion.div>) {
  const reduced = useReducedMotion();
  const defaultInitial = reduced ? false : { opacity: 0, filter: "blur(1px)" };
  return (
    <motion.div
      className={cn("t-stagger-item", className)}
      initial={initial !== undefined ? initial : defaultInitial}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={reduced ? undefined : { opacity: 0, filter: "blur(1px)" }}
      transition={reduced ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      {...props}
    />
  );
}
