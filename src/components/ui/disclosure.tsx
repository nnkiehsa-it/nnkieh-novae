"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { timing } from "@/lib/motion-timing";
import { rowClass } from "@/components/ui/list";
import { cn } from "@/lib/utils";

/**
 * A row that opens onto more of itself.
 *
 * Content that appears has to disappear the same way: several places in the
 * product swapped a block in and out of the document with nothing between the
 * two states, so the page jumped on the way in and jumped again on the way out.
 * One component owns the row, the mark that turns, and the height the content
 * travels through in both directions.
 */
export function Disclosure({
  children,
  defaultOpen = false,
  label,
  value,
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
  label: React.ReactNode;
  /** What the row reports while it is closed. */
  value?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div>
      <button
        aria-expanded={open}
        className={cn(rowClass, "w-full")}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="min-w-0 flex-1 text-[0.9375rem] leading-6">{label}</span>
        {value === undefined || value === null || value === "" ? null : (
          <span className="shrink-0 text-[0.9375rem] text-muted-foreground">{value}</span>
        )}
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-[var(--motion-control)] ease-[var(--ease-move)]",
            open && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={timing("control")}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
