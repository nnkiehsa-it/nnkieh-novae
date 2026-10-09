"use client";
import type { ReactNode } from "react";
import { Segmented } from "framework7-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export interface LiquidTabOption {
  icon?: ReactNode;
  label: string;
  value: string;
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
          <Button
            type="button"
            role="tab"
            aria-label={option.label}
            aria-selected={option.value === value}
            className={cn(option.value === value && "button-active")}
            data-liquid-tab={option.value}
            data-displayed-active={option.value === value}
            tabIndex={option.value === value ? 0 : -1}
            disabled={disabled}
            variant="ghost"
            key={option.value}
            onClick={() => onValueChange(option.value)}
          >
            {option.icon}
            <span
              className={cn(
                compact && option.value !== value && "hidden sm:inline",
              )}
            >
              {option.label}
            </span>
          </Button>
        ))}
      </Segmented>
    </div>
  );
}
