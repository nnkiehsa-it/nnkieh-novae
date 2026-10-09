"use client";

import * as React from "react";
import { Segmented } from "framework7-react";
import { cn } from "@/lib/utils";

export interface LiquidTabOption { icon?: React.ReactNode; label: string; value: string }

export function LiquidTabs({ ariaLabel, className, compact = false, disabled = false, onValueChange, options, value }: {
  ariaLabel: string; className?: string; compact?: boolean; disabled?: boolean;
  onValueChange: (value: string) => void; options: LiquidTabOption[]; value: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={className}>
    <Segmented strong className="novae-tabs">
      {options.map((option, index) => (
        <button type="button" role="tab" aria-label={option.label} aria-selected={option.value === value}
          className={cn("button novae-button", option.value === value && "button-active")}
          data-liquid-tab={option.value} data-displayed-active={option.value === value}
          tabIndex={option.value === value ? 0 : -1} disabled={disabled} key={option.value}
          onClick={() => onValueChange(option.value)}
          onKeyDown={(event) => {
            const next = event.key === "ArrowRight" ? (index + 1) % options.length
              : event.key === "ArrowLeft" ? (index + options.length - 1) % options.length
                : event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : null;
            if (next === null) return;
            event.preventDefault();
            onValueChange(options[next].value);
            (event.currentTarget.parentElement?.querySelectorAll("button")[next] as HTMLElement).focus();
          }}>
          {option.icon}
          <span className={cn(compact && option.value !== value && "hidden sm:inline")}>{option.label}</span>
        </button>
      ))}
    </Segmented>
    </div>
  );
}
