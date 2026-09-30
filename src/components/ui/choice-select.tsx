"use client";

import * as React from "react";
import { rowClass } from "@/components/ui/list";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface ChoiceOption {
  disabled?: boolean;
  label: string;
  value: string;
}

/** Shared compact breakpoint for responsive action menus. */
const COMPACT_VIEWPORT = "(max-width: 47.99rem)";

function subscribeCompact(onChange: () => void) {
  const query = window.matchMedia(COMPACT_VIEWPORT);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Whether the screen uses compact layouts. */
export function useCompactViewport() {
  return React.useSyncExternalStore(
    subscribeCompact,
    () => window.matchMedia(COMPACT_VIEWPORT).matches,
    () => false,
  );
}

/** One selection dropdown at every viewport size. */
export function ChoiceSelect({
  ariaCurrent,
  ariaLabel,
  className,
  controlLabel = "",
  disabled,
  onValueChange,
  options,
  size = "default",
  title,
  trigger,
  value,
}: {
  ariaCurrent?: "page";
  ariaLabel: string;
  className?: string;
  /** How the trigger is typed: a control by default, or a page's own heading. */
  controlLabel?: "" | "heading";
  disabled?: boolean;
  onValueChange: (value: string) => void;
  options: readonly ChoiceOption[];
  size?: "sm" | "default";
  /** Accessible label for the dropdown's options. */
  title: string;
  /** What the trigger shows. The chosen option's label, unless said otherwise. */
  trigger?: (selected: ChoiceOption | undefined) => React.ReactNode;
  value: string;
}) {
  const selected = options.find((option) => option.value === value);
  const content = trigger ? trigger(selected) : selected?.label;

  return (
      <Select disabled={disabled} onValueChange={onValueChange} value={value}>
        <SelectTrigger
          aria-current={ariaCurrent}
          aria-label={ariaLabel}
          data-displayed-active={ariaCurrent === "page"}
          className={className}
          data-control-label={controlLabel}
          size={size}
        >
          {content}
        </SelectTrigger>
        <SelectContent aria-label={title}>
          {options.map((option) => (
            <SelectItem disabled={option.disabled} key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );

}

/**
 * The choice as a row of a list: the question on the left, the answer on the
 * right, and the whole row the target.
 */
export function ListPicker({
  disabled,
  label,
  onChange,
  options,
  placeholder,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: readonly ChoiceOption[];
  placeholder?: string;
  value: string;
}) {
  return (
    <ChoiceSelect
      ariaLabel={label}
      className={cn(
        rowClass,
        "h-auto justify-between rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:border-transparent focus-visible:ring-0",
      )}
      disabled={disabled}
      onValueChange={onChange}
      options={options}
      title={label}
      trigger={(selected) => (
        <>
          <span className="min-w-0 flex-1 text-left text-[0.9375rem] leading-6">{label}</span>
          <span className={cn("shrink-0", !selected && "text-muted-foreground")}>
            {selected?.label ?? placeholder}
          </span>
        </>
      )}
      value={value}
    />
  );
}
