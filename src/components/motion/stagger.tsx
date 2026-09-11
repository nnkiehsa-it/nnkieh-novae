"use client";

import type { ComponentProps, ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { timing } from "@/lib/motion-timing";
import { cn } from "@/lib/utils";

/**
 * A list whose rows animate only once the list itself is already on screen.
 *
 * `initial={false}` is the whole point: the rows a list is born with do not
 * animate. iOS never animates a table view's first paint, and animating it here
 * meant every navigation arrived at a page that was still assembling itself,
 * underneath a route transition that had already delivered it.
 */
export function StaggerList({
  children,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children"> & { children: ReactNode }) {
  return (
    <div className={cn("t-stagger-list relative", className)} {...props}>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </div>
  );
}

// Rows added or removed later hand over on opacity alone, on one rung, with no
// stagger between them: blurring or displacing each row made an ordinary
// re-render read as a reload, and delaying each row by its index made the row
// the user was reaching for the last one to arrive.
export function StaggerItem({
  className,
  ...props
}: ComponentProps<typeof motion.div>) {
  return (
    <motion.div
      className={cn("t-stagger-item", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={timing("control")}
      {...props}
    />
  );
}
