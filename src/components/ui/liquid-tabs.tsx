"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

export interface LiquidTabOption {
  icon?: React.ReactNode;
  label: string;
  shortLabel?: string;
  value: string;
}

interface LiquidTabsProps {
  ariaLabel: string;
  className?: string;
  onValueChange: (value: string) => void;
  options: LiquidTabOption[];
  value: string;
}

export function LiquidTabs({
  ariaLabel,
  className,
  onValueChange,
  options,
  value,
}: LiquidTabsProps) {
  const indicatorId = React.useId();
  const reduceMotion = useReducedMotion();
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange}>
      <TabsPrimitive.List
        aria-label={ariaLabel}
        className={cn(
          "relative isolate inline-flex h-8 max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-muted p-[3px]",
          className,
        )}
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
          <TabsPrimitive.Trigger
            key={option.value}
            value={option.value}
            data-liquid-tab={option.value}
            className="t-tab-label relative isolate inline-flex h-[1.625rem] shrink-0 items-center justify-center gap-1 rounded-full px-3 font-medium leading-3.5 text-muted-foreground outline-none transition-colors duration-[var(--motion-quick)] ease-[var(--ease-smooth-out)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 data-[state=active]:text-foreground"
          >
            {active ? (
              <motion.span
                className="absolute inset-0 -z-10 rounded-full bg-card shadow-[var(--shadow-control)]"
                layoutId={`segmented-control-${indicatorId}`}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 520, damping: 38, mass: 0.7 }
                }
              />
            ) : null}
            <span className="relative z-10 contents">{option.icon}</span>
            <span className={cn("relative z-10", option.shortLabel && "hidden sm:inline")}>
              {option.label}
            </span>
            {option.shortLabel ? (
              <span className="relative z-10 sm:hidden">{option.shortLabel}</span>
            ) : null}
          </TabsPrimitive.Trigger>
          );
        })}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}
