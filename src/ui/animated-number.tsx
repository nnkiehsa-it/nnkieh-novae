"use client";

import { AnimatePresence, motion } from "motion/react";
import { timing } from "@/lib/motion-timing";
import { cn } from "@/lib/utils";

/**
 * A number that changed while the user was looking at it rolls to its new
 * value: the old one leaves upward, the new one arrives from below.
 *
 * The whole value moves as one. Animating each digit on its own delay turned a
 * count going from 9 to 10 into a small piece of choreography, which is a lot
 * of attention to spend on a number nobody asked to watch.
 */
export function AnimatedNumber({
  className,
  value,
}: {
  className?: string;
  value: number | string;
}) {
  const text = String(value);
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 whitespace-nowrap overflow-hidden tabular-nums",
        className,
      )}
      aria-label={text}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          aria-hidden
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex whitespace-nowrap"
          exit={{ opacity: 0, y: -8 }}
          initial={{ opacity: 0, y: 8 }}
          key={text}
          transition={timing("control")}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function AnimatedText({
  className,
  text,
}: {
  className?: string;
  text: string;
}) {
  return (
    <span className={cn("inline-grid overflow-hidden", className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ opacity: 1, y: 0 }}
          className="col-start-1 row-start-1"
          exit={{ opacity: 0, y: -4 }}
          initial={{ opacity: 0, y: 4 }}
          key={text}
          transition={timing("control")}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
