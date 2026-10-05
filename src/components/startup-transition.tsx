"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { timing } from "@/lib/motion-timing";

/** Mount the ready screen beneath the departing gate, with no blank frame. */
export function StartupTransition({ startup, children }: {
  startup: React.ReactNode;
  children: React.ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  return <>
    {children && <motion.div key="app" initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={timing("control")}>
      {children}
    </motion.div>}
    <AnimatePresence initial={false}>
      {startup && <motion.div key="startup" className="fixed inset-0 z-50 overflow-y-auto bg-background" exit={reducedMotion ? undefined : { opacity: 0 }} transition={timing("controlExit")}>
        {startup}
      </motion.div>}
    </AnimatePresence>
  </>;
}
