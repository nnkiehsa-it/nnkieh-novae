"use client";

import type { ComponentProps, ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

export function StaggerList({
  children,
  className,
  ...props
}: Omit<ComponentProps<typeof motion.div>, "children"> & { children: ReactNode }) {
  return (
    <motion.div className={cn("t-stagger-list relative", className)} layout {...props}>
      <AnimatePresence initial={false} mode="popLayout">
        {children}
      </AnimatePresence>
    </motion.div>
  );
}

export function StaggerItem({ className, ...props }: ComponentProps<typeof motion.div>) {
  return (
    <motion.div
      className={cn("t-stagger-item", className)}
      initial={{ opacity: 0, scale: 0.975, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: -8 }}
      layout="position"
      transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.72 }}
      {...props}
    />
  );
}
