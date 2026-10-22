import * as React from "react";
import { motion } from "motion/react";
import { Tabs } from "radix-ui";
import { timing } from "@/lib/motion-timing";
import { cn } from "@/lib/utils";

export interface SegmentedOption<Value extends string = string> {
  icon?: React.ReactNode;
  label: string;
  value: Value;
}

/**
 * A pill rail of mutually exclusive views. The white pill slides to the
 * selected option; the rail scrolls sideways when the options outgrow it.
 */
export function Segmented<Value extends string>({
  className,
  label,
  onChange,
  options,
  size = "md",
  value,
}: {
  className?: string;
  label: string;
  onChange: (value: Value) => void;
  options: SegmentedOption<Value>[];
  size?: "md" | "lg";
  value: Value;
}) {
  const pillId = React.useId();
  return (
    <Tabs.Root className={cn("min-w-0 max-w-full", className)} onValueChange={(next) => onChange(next as Value)} value={value}>
      {/* The pill is measured against the rail (`layoutRoot`), not the page, so
          scrolling or a pinned header never sends it flying from elsewhere. */}
      <Tabs.List aria-label={label} asChild>
        <motion.div
          className="glass-float inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full p-1 [scrollbar-width:none]"
          layoutRoot
        >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Tabs.Trigger
              className={cn(
                "relative isolate inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-medium outline-none transition-[color] duration-[var(--motion-control)] ease-[var(--ease-move)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                size === "lg" ? "h-11 px-5 text-[0.9375rem]" : "h-9 px-4 text-sm",
                selected ? "text-on-contrast" : "text-ink-muted hover:text-ink",
              )}
              key={option.value}
              value={option.value}
            >
              {selected ? (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 -z-10 rounded-full bg-contrast"
                  initial={false}
                  layoutId={pillId}
                  transition={timing("nav", "nav")}
                />
              ) : null}
              {option.icon ? <span aria-hidden className="inline-flex [&_svg]:size-4">{option.icon}</span> : null}
              {option.label}
            </Tabs.Trigger>
          );
        })}
        </motion.div>
      </Tabs.List>
    </Tabs.Root>
  );
}
