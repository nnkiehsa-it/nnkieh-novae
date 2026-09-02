"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

export function stateTransitionIdentity({
  empty,
  error,
  loading,
}: {
  empty: boolean;
  error: boolean;
  loading: boolean;
}) {
  if (error) return "error";
  if (loading) return "loading";
  return empty ? "empty" : "content";
}

export function StateTransition({
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
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={cn("origin-top", className)}
        exit={{ opacity: 0, scale: 0.985, y: -10 }}
        initial={{ opacity: 0, scale: 0.985, y: 14 }}
        key={identity}
        layout
        transition={{ type: "spring", stiffness: 360, damping: 36, mass: 0.74 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
