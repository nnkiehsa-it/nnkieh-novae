"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { timing } from "@/lib/motion-timing";
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * One screen of the install conversation.
 *
 * Every screen is the same shape — a mark, what is happening, what to do about
 * it, and the way on — so moving between them reads as one dialog changing its
 * mind rather than as several dialogs taking turns.
 */
// Moving on and going back have to read differently, so the direction travels
// with the step — including the one on its way out, which AnimatePresence hands
// the latest value through `custom`.
const stepVariants = {
  center: { opacity: 1, scale: 1, x: 0 },
  enter: (direction: 1 | -1) => ({ opacity: 0, scale: 0.98, x: 12 * direction }),
  exit: (direction: 1 | -1) => ({ opacity: 0, scale: 0.98, x: -12 * direction }),
};

export function PromptStep({
  actions,
  description,
  direction,
  icon,
  note,
  steps,
  title,
}: {
  actions: ReactNode;
  description: string;
  direction: 1 | -1;
  icon: ReactNode;
  note?: string;
  steps?: string[];
  title: string;
}) {
  return (
    <motion.div
      animate="center"
      className="grid gap-5"
      custom={direction}
      exit="exit"
      initial="enter"
      transition={timing("sheetExit")}
      variants={stepVariants}
    >
      <SheetHeader>
        <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-accent text-foreground">
          {icon}
        </div>
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>{description}</SheetDescription>
      </SheetHeader>

      {steps?.length ? (
        <ol className="space-y-3">
          {steps.map((step, index) => (
            <li className="flex gap-3 text-sm leading-6" key={step}>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {note ? (
        <p className="rounded-xl bg-accent/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
          {note}
        </p>
      ) : null}

      <SheetFooter>{actions}</SheetFooter>
    </motion.div>
  );
}
