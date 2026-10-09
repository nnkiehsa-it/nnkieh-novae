"use client";

import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { rowClass } from "./list";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "@/lib/utils";

export interface ChoiceOption { disabled?: boolean; label: string; value: string }
const COMPACT_VIEWPORT = "(max-width: 47.99rem)";
function subscribeCompact(onChange: () => void) {
  const query = window.matchMedia(COMPACT_VIEWPORT);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
export function useCompactViewport() {
  return React.useSyncExternalStore(subscribeCompact, () => window.matchMedia(COMPACT_VIEWPORT).matches, () => false);
}
export function ChoiceSelect({ ariaCurrent, ariaLabel, className, controlLabel = "", disabled, onValueChange,
  options, size = "default", title, trigger, value }: {
  ariaCurrent?: "page"; ariaLabel: string; className?: string; controlLabel?: "" | "heading";
  disabled?: boolean; onValueChange: (value: string) => void; options: readonly ChoiceOption[];
  size?: "sm" | "default"; title: string; trigger?: (selected: ChoiceOption | undefined) => React.ReactNode; value: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((option) => option.value === value);
  const optionsRef = React.useRef<HTMLDivElement>(null);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button aria-current={ariaCurrent} aria-label={ariaLabel} aria-haspopup="listbox"
      className={cn("justify-between", className)} data-control-label={controlLabel}
      data-slot="select-trigger" data-displayed-active={ariaCurrent === "page"} disabled={disabled} size={size} variant="ghost">
      {trigger ? trigger(selected) : <span className="min-w-0 truncate">{selected?.label}</span>}<ChevronDown className="size-4 shrink-0" />
    </Button></PopoverTrigger>
    <PopoverContent aria-label={title} aria-labelledby={undefined}>
      <div role="listbox" aria-label={title} ref={optionsRef} onKeyDown={(event) => {
        const entries = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const current = entries.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === "ArrowDown" ? (current + 1) % entries.length : event.key === "ArrowUp"
          ? (current + entries.length - 1) % entries.length : event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1 : null;
        if (next === null || !entries.length) return;
        event.preventDefault(); entries[next].focus();
      }}>
        {options.map((option) => <button type="button" role="option" aria-selected={option.value === value}
          className="item-link flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent disabled:opacity-50"
          disabled={option.disabled} key={option.value} onClick={() => { onValueChange(option.value); setOpen(false); }}>
          <span className="flex-1">{option.label}</span>{option.value === value ? <Check className="size-4 text-tint-content" /> : null}
        </button>)}
      </div>
    </PopoverContent>
  </Popover>;
}
export function ListPicker({ disabled, label, onChange, options, placeholder, value }: {
  disabled?: boolean; label: string; onChange: (value: string) => void; options: readonly ChoiceOption[]; placeholder?: string; value: string;
}) {
  return <ChoiceSelect ariaLabel={label} className={cn(rowClass, "h-auto justify-between rounded-none border-0 bg-transparent px-0 shadow-none")}
    disabled={disabled} onValueChange={onChange} options={options} title={label} value={value}
    trigger={(selected) => <><span className="min-w-0 flex-1 text-left text-[0.9375rem] leading-6">{label}</span>
      <span className="shrink-0 text-muted-foreground">{selected?.label ?? placeholder}</span></>} />;
}
