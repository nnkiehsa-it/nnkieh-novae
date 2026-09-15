"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ListSection, rowClass } from "@/components/ui/list";
import { ListChoiceRow } from "@/components/ui/list-controls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  selectTriggerClass,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface ChoiceOption {
  disabled?: boolean;
  label: string;
  value: string;
}

/** The width at which a menu stops being a menu, matching the sheet's own. */
const COMPACT_VIEWPORT = "(max-width: 47.99rem)";

function subscribeCompact(onChange: () => void) {
  const query = window.matchMedia(COMPACT_VIEWPORT);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Whether this screen is narrow enough that a menu should be a sheet. */
export function useCompactViewport() {
  return React.useSyncExternalStore(
    subscribeCompact,
    () => window.matchMedia(COMPACT_VIEWPORT).matches,
    () => false,
  );
}

/**
 * One choice out of a few, asked in the shape the screen calls for.
 *
 * A menu that opens beside its control is a pointer's idea of a choice: on a
 * phone it lands wherever there is room, its rows are the size of a mouse
 * target rather than a thumb, and a long list is a tiny scrolling box. The same
 * choice on a phone is a sheet from the bottom edge, with the options as the
 * same rows the rest of the product asks questions with, and the page settling
 * back behind it. The trigger is the same object either way.
 */
export function ChoiceSelect({
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
  ariaLabel: string;
  className?: string;
  /** How the trigger is typed: a control by default, or a page's own heading. */
  controlLabel?: "" | "heading";
  disabled?: boolean;
  onValueChange: (value: string) => void;
  options: readonly ChoiceOption[];
  size?: "sm" | "default";
  /** What the sheet calls the choice it is asking for. */
  title: string;
  /** What the trigger shows. The chosen option's label, unless said otherwise. */
  trigger?: (selected: ChoiceOption | undefined) => React.ReactNode;
  value: string;
}) {
  const compact = useCompactViewport();
  const [open, setOpen] = React.useState(false);
  const selected = options.find((option) => option.value === value);
  const content = trigger ? trigger(selected) : selected?.label;

  if (!compact)
    return (
      <Select disabled={disabled} onValueChange={onValueChange} value={value}>
        <SelectTrigger
          aria-label={ariaLabel}
          className={className}
          data-control-label={controlLabel}
          size={size}
        >
          {content}
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem disabled={option.disabled} key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );

  return (
    <>
      <button
        aria-label={ariaLabel}
        className={cn(selectTriggerClass, size === "sm" ? "h-9" : "h-10", className)}
        data-control-label={controlLabel}
        data-size={size}
        disabled={disabled}
        onClick={() => setOpen(true)}
        type="button"
      >
        {content}
        <ChevronDownIcon className="t-disclosure-icon size-4 opacity-50" />
      </button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="sm:max-w-xl" presentation="sheet">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <ListSection groupName={title}>
            {options.map((option) => (
              <ListChoiceRow
                disabled={option.disabled}
                key={option.value}
                label={option.label}
                onSelect={() => {
                  onValueChange(option.value);
                  setOpen(false);
                }}
                selected={option.value === value}
              />
            ))}
          </ListSection>
        </DialogContent>
      </Dialog>
    </>
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
