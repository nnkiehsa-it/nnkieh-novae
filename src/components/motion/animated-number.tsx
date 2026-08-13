"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export function AnimatedNumber({
  className,
  value,
}: {
  className?: string;
  value: number | string;
}) {
  const text = String(value);
  const reduceMotion = useReducedMotion();
  return (
    <span
      className={cn(
        "relative inline-flex overflow-hidden tabular-nums",
        className,
      )}
      aria-label={text}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          className="inline-flex"
          key={text}
          aria-hidden
          exit={reduceMotion ? undefined : { filter: "blur(2px)", opacity: 0, y: -4 }}
          transition={{ duration: 0.15, ease: "easeInOut" }}
        >
          {Array.from(text).map((character, index) => {
            const trailingIndex = Math.max(0, index - (text.length - 2));
            return (
              <motion.span
                className="inline-block"
                initial={
                  reduceMotion
                    ? false
                    : { filter: "blur(2px)", opacity: 0, y: 8 }
                }
                animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                key={`${character}-${index}`}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : {
                        delay: trailingIndex * 0.07,
                        duration: 0.5,
              ease: [0.16, 1, 0.3, 1],
                      }
                }
              >
                {character}
              </motion.span>
            );
          })}
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
  const reduceMotion = useReducedMotion();
  return (
    <span className={cn("inline-grid overflow-hidden", className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          className="col-start-1 row-start-1"
          key={text}
          initial={reduceMotion ? false : { filter: "blur(2px)", opacity: 0, y: 4 }}
          animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { filter: "blur(2px)", opacity: 0, y: -4 }}
          transition={{ duration: reduceMotion ? 0 : 0.15, ease: "easeInOut" }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
