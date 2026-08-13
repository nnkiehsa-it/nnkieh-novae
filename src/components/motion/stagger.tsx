"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";

export function StaggerList(props: HTMLMotionProps<"div">) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={reducedMotion ? false : "hidden"}
      animate="visible"
      variants={{
        visible: {
          transition: { staggerChildren: reducedMotion ? 0 : 0.04 },
        },
      }}
      {...props}
    />
  );
}

export function StaggerItem(props: HTMLMotionProps<"div">) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      variants={{
        hidden: reducedMotion
          ? { opacity: 1 }
          : { filter: "blur(3px)", opacity: 0, y: 12 },
        visible: { filter: "blur(0px)", opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      {...props}
    />
  );
}
