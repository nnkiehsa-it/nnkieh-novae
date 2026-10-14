"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { timing } from "@/lib/motion-timing";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/feedback";
import { Tile } from "@/ui/panel";

/** A count that rolls to its new value when it changes while being watched. */
export function AnimatedNumber({ className, value }: { className?: string; value: number }) {
  const text = String(value);
  return (
    <span aria-label={text} className={cn("relative inline-flex overflow-hidden whitespace-nowrap tabular-nums", className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ opacity: 1, y: 0 }}
          aria-hidden
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

interface Figure {
  label: string;
  /** Absent while the reading is still arriving. */
  value: React.ReactNode | undefined;
}

/** Headline figures side by side, each on its own tile. */
export function FigureGrid({ figures }: { figures: readonly Figure[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {figures.map(({ label, value }) => (
        <Tile className="min-w-0" key={label}>
          <p className="truncate text-sm text-ink-muted">{label}</p>
          <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
            {value === undefined ? <Skeleton className="h-8 w-16" /> : value}
          </div>
        </Tile>
      ))}
    </div>
  );
}
