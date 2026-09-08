"use client";

import type { ComponentProps, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export function StateTransition({
  children,
  className,
  identity,
  ...props
}: {
  children: ReactNode;
  className?: string;
  identity: string;
} & Omit<ComponentProps<"div">, "children">) {
  return (
    <div
      className={cn("t-state-transition", className)}
      data-resize-motion=""
      data-state-transition={identity}
      {...props}
    >
      {children}
    </div>
  );
}

export function ContentTransition({
  children,
  className,
  identity,
}: {
  children: ReactNode;
  className?: string;
  identity: string;
}) {
  const reduced = useReducedMotion();
  const transition = reduced
    ? { duration: 0 }
    : { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const };
  const entrance = reduced ? false : { opacity: 0, y: 6, filter: "blur(1px)" };
  const exit = reduced ? undefined : { opacity: 0, y: -4, filter: "blur(1px)" };

  return (
    <AnimatePresence initial mode="popLayout">
      <motion.div
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        className={cn("t-state-content", className)}
        exit={exit}
        initial={entrance}
        key={identity}
        transition={transition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
