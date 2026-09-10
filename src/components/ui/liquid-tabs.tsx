"use client";

import * as React from "react";
import { motion } from "motion/react";
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
  disabled?: boolean;
  onValueChange: (value: string) => void;
  options: LiquidTabOption[];
  value: string;
}

export function LiquidTabs({
  ariaLabel,
  className,
  disabled = false,
  onValueChange,
  options,
  value,
}: LiquidTabsProps) {
  const layoutId = React.useId();
  const [pressedTab, setPressedTab] = React.useState<{
    fromValue: string;
    value: string;
  } | null>(null);
  const pressedResetRef = React.useRef(0);
  const displayedValue =
    pressedTab?.fromValue === value ? pressedTab.value : value;

  React.useEffect(
    () => () => window.clearTimeout(pressedResetRef.current),
    [],
  );

  const acknowledgeTab = React.useCallback(
    (nextValue: string) => {
      if (nextValue === displayedValue) return;
      setPressedTab({ fromValue: value, value: nextValue });
      window.clearTimeout(pressedResetRef.current);
      pressedResetRef.current = window.setTimeout(
        () => setPressedTab(null),
        1_000,
      );
    },
    [displayedValue, value],
  );

  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange}>
      <TabsPrimitive.List
        aria-label={ariaLabel}
        aria-disabled={disabled}
        className={cn(
          "t-tabs relative isolate inline-flex h-9 max-w-full items-center gap-1 overflow-x-auto rounded-full p-[3px]",
          className,
        )}
      >
        {options.map((option) => {
          const displayedActive = option.value === displayedValue;

          return (
            <TabsPrimitive.Trigger
              className="t-tab t-tab-label relative z-10 isolate inline-flex h-[1.875rem] shrink-0 items-center justify-center gap-1 rounded-full px-3 font-semibold leading-4 text-muted-foreground outline-none transition-colors duration-[var(--motion-control)] ease-[var(--ease-move)] focus-visible:ring-2 focus-visible:ring-ring"
              data-control-label=""
              data-displayed-active={displayedActive}
              data-liquid-tab={option.value}
              disabled={disabled}
              key={option.value}
              onPointerDown={() => {
                if (!disabled) acknowledgeTab(option.value);
              }}
              value={option.value}
            >
              {displayedActive ? (
                <motion.span
                  aria-hidden="true"
                  className="t-tabs-pill absolute inset-0 z-0 rounded-full"
                  initial={false}
                  layoutId={`liquid-tab-pill-${layoutId}`}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                />
              ) : null}
              {option.icon ? (
                <span aria-hidden="true" className="relative z-10 inline-flex shrink-0">
                  {option.icon}
                </span>
              ) : null}
              <span
                className={cn(
                  "relative z-10",
                  option.shortLabel && "hidden sm:inline",
                )}
              >
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
