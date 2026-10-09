"use client";
import type { ReactNode } from "react";
import { Button, Segmented } from "framework7-react";
import { useFramework7Control } from "./use-framework7-control";

export interface LiquidTabOption {
  icon?: ReactNode;
  label: string;
  value: string;
}
function Segment({option, selected, compact, disabled, onSelect}: {
  option: LiquidTabOption; selected: boolean; compact: boolean; disabled: boolean; onSelect: () => void;
}) {
  const ref = useFramework7Control<HTMLButtonElement>(undefined, undefined, {
    role: "tab", "aria-label": option.label, "aria-selected": selected,
    tabindex: selected ? 0 : -1, disabled,
  });
  return <Button type="button" ref={ref} active={selected} disabled={disabled} small={compact}
    data-liquid-tab={option.value} data-displayed-active={selected} onClick={onSelect}>
    {option.icon}<span>{option.label}</span>
  </Button>;
}
export function LiquidTabs({
  ariaLabel,
  className,
  compact = false,
  disabled = false,
  onValueChange,
  options,
  value,
}: {
  ariaLabel: string;
  className?: string;
  compact?: boolean;
  disabled?: boolean;
  onValueChange: (value: string) => void;
  options: LiquidTabOption[];
  value: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={className}
      onKeyDown={(event) => {
        if (disabled) return;
        const target = (event.target as Element).closest<HTMLElement>(
          "[data-liquid-tab]",
        );
        if (!target) return;
        const index = options.findIndex(
          (option) => option.value === target.dataset.liquidTab,
        );
        const next =
          event.key === "ArrowRight"
            ? (index + 1) % options.length
            : event.key === "ArrowLeft"
              ? (index + options.length - 1) % options.length
              : event.key === "Home"
                ? 0
                : event.key === "End"
                  ? options.length - 1
                  : null;
        if (next === null) return;
        event.preventDefault();
        onValueChange(options[next].value);
        const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button");
        buttons[next].focus();
      }}
    >
      <Segmented strong className="novae-tabs">
        {options.map((option) => (
          <Segment
            option={option}
            selected={option.value === value}
            disabled={disabled}
            compact={compact}
            key={option.value}
            onSelect={() => onValueChange(option.value)}
          />
        ))}
      </Segmented>
    </div>
  );
}
