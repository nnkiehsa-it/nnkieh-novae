"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
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
    <motion.div
      animate={{ opacity: 1 }}
      className={cn("origin-top", className)}
      data-state-transition={identity}
      initial={{ opacity: 0 }}
      key={identity}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
