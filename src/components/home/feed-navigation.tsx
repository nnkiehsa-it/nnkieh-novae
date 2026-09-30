"use client";

import type { ReactNode } from "react";
import { ChoiceSelect, type ChoiceOption } from "@/components/ui/choice-select";
import { cn } from "@/lib/utils";

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
  const controlClass = "t-tab t-tab-label inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full border-0 px-3 font-semibold leading-4 outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <nav aria-label={label} className="min-w-0 max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="t-tabs inline-flex items-center gap-[3px] rounded-full bg-[var(--tabs-bar-bg)] p-[3px]">
        {options.map((option) => {
          const active = option.value === value;
          const className = cn(controlClass, active
            ? "bg-[var(--tabs-pill-bg)] text-[var(--tabs-text-active)] shadow-[var(--shadow-control)]"
            : "bg-transparent text-[var(--tabs-text-muted)]");
          const icon = <span aria-hidden="true" className="inline-flex shrink-0">{option.icon}</span>;
          return active && option.category ? (
            <ChoiceSelect
              key={option.value}
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
              key={option.value}
              onClick={() => onChange(option.value)}
              type="button"
            >
              {icon}{option.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
