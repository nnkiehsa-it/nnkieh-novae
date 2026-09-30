"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChoiceSelect, type ChoiceOption } from "@/components/ui/choice-select";
import { cn } from "@/lib/utils";
import { timing } from "@/lib/motion-timing";
import styles from "./feed-navigation.module.css";

/** Measure the natural control width so resizing never scales its text or icon. */
function AnimatedFeedControl({ children }: { children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>();
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const content = contentRef.current!;
    const measure = () => setWidth(content.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      animate={reducedMotion ? undefined : { width }}
      style={reducedMotion ? { width } : undefined}
      className={cn(styles.frame, "h-10 shrink-0 overflow-hidden rounded-full focus-within:ring-2 focus-within:ring-ring")}
      initial={false}
      transition={timing("nav", "nav")}
    >
      <div ref={contentRef} className="w-max">{children}</div>
    </motion.div>
  );
}

export interface FeedNavigationOption {
  value: string;
  label: string;
  icon: ReactNode;
  category?: {
    value: string;
    options: readonly ChoiceOption[];
    label: string;
    onChange: (value: string) => void;
  };
}

/** Active feeds expose their category picker in the same navigation rail. */
export function FeedNavigation({ label, options, value, onChange }: {
  label: string;
  options: FeedNavigationOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const controlClass = "t-tab t-tab-label inline-flex h-10 shrink-0 items-center justify-center gap-1.5 px-3.5 font-semibold leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <nav aria-label={label} className="min-w-0 max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex items-center gap-[3px] rounded-full bg-[var(--tabs-bar-bg)] p-1">
        {options.map((option) => {
          const active = option.value === value;
          const className = cn(controlClass, styles.control, active
            ? "text-[var(--tint-content)]"
            : "bg-transparent text-[var(--tabs-text-muted)]");
          const icon = <span aria-hidden="true" className="inline-flex shrink-0">{option.icon}</span>;
          return <AnimatedFeedControl key={option.value}>{active && option.category ? (
            <ChoiceSelect
              ariaCurrent="page"
              ariaLabel={`${option.label}: ${option.category.label}`}
              className={cn(className, "max-w-56 gap-1.5")}
              onValueChange={option.category.onChange}
              options={option.category.options}
              title={option.category.label}
              trigger={(selected) => <>{icon}<span className="truncate">{selected?.label}</span></>}
              value={option.category.value}
            />
          ) : (
            <button
              aria-current={active ? "page" : undefined}
              data-displayed-active={active}
              className={className}
              data-control-label=""
              onClick={() => onChange(option.value)}
              type="button"
            >
              {icon}{option.label}
            </button>
          )}</AnimatedFeedControl>;
        })}
      </div>
    </nav>
  );
}
