"use client";

import type * as React from "react";
import { motion } from "motion/react";
import { timing } from "@/lib/motion-timing";

/**
 * A block of the screen that fades in and out rather than being there on one
 * frame and gone on the next, which reads as the page losing its place.
 * Wrap it in `AnimatePresence` for the exit to play.
 */
export function Reveal({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      initial={{ opacity: 0, y: 8 }}
      transition={timing("control")}
    >
      {children}
    </motion.div>
  );
}
