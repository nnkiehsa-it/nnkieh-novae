"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { getCardClassName } from "@/components/ui/card";

const cardLayoutTransition = {
  duration: 0.3,
  ease: [0.22, 1, 0.36, 1],
} as const;

export function ResizableCard({ className, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      className={getCardClassName(className)}
      data-slot="card"
      layout="position"
      transition={{ layout: cardLayoutTransition }}
      {...props}
    />
  );
}
