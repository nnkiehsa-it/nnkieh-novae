"use client";

import { SlidersHorizontal } from "lucide-react";
import { ChoiceSelect, type ChoiceOption } from "@/components/ui/choice-select";
import { cn } from "@/lib/utils";
import styles from "./sort-control.module.css";

/** Shared sorting affordance for feeds and discussions. */
export function SortControl({ label, options, value, onChange, disabled, iconOnly = false, className }: {
  label: string;
  options: readonly ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  iconOnly?: boolean;
  className?: string;
}) {
  return (
    <ChoiceSelect
      ariaLabel={label}
      className={cn(
        styles.control,
        "size-9 shrink-0 justify-center gap-0 border-0 bg-transparent px-0 shadow-none [&_.t-disclosure-icon]:hidden",
        !iconOnly && "sm:w-36 sm:justify-between sm:gap-2 sm:px-3 sm:[&_.t-disclosure-icon]:block",
        className,
      )}
      disabled={disabled}
      onValueChange={onChange}
      options={options}
      size="sm"
      title={label}
      trigger={(selected) => <>
        <SlidersHorizontal aria-hidden className={cn("size-4", !iconOnly && "sm:hidden")} />
        <span className={iconOnly ? "sr-only" : "sr-only sm:not-sr-only"}>{selected?.label}</span>
      </>}
      value={value}
    />
  );
}
