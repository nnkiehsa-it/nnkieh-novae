"use client";

import type { ComponentProps, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export function StaggerList({
  children,
  className,
  ...props
}: Omit<ComponentProps<typeof motion.div>, "children"> & { children: ReactNode }) {
  return (
    <motion.div className={cn("t-stagger-list relative", className)} layout="position" {...props}>
      <AnimatePresence mode="popLayout">
        {children}
      </AnimatePresence>
    </motion.div>
  );
}

export function StaggerItem({ className, ...props }: ComponentProps<typeof motion.div>) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={cn("t-stagger-item", className)}
      initial={reduced ? false : { opacity: 0, y: 8, filter: "blur(1px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={reduced ? undefined : { opacity: 0, y: -6, filter: "blur(1px)" }}
      layout="position"
      transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 34, mass: 0.72 }}
      {...props}
    />
  );
}
