"use client";

import { Check } from "lucide-react";
import * as React from "react";

import { Input } from "@/components/ui/input";
import { RowInner, rowClass, type RowContent } from "@/components/ui/list";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** On or off. The whole row is the label, so the switch never stands alone. */
export function ListSwitchRow({
  checked,
  disabled,
  name,
  onCheckedChange,
  ...content
}: RowContent & {
  checked: boolean;
  disabled?: boolean;
  name: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  // A switch is a button, so a wrapping label forwards nothing to it. The row
  // has to carry the press itself for the whole row to be the target, which is
  // the point of a list.
  return (
    <div
      className={cn(rowClass, disabled ? "opacity-50" : "cursor-pointer")}
      onClick={(event) => {
        if (disabled) return;
        if ((event.target as Element).closest('[data-slot="switch"]')) return;
        onCheckedChange(!checked);
      }}
    >
      <RowInner
        {...content}
        trailing={
          <Switch
            aria-label={name}
            checked={checked}
            className="shrink-0"
            disabled={disabled}
            onCheckedChange={onCheckedChange}
          />
        }
      />
    </div>
  );
}

/**
 * One of several. The mark is a check that fades in, not a box: a box asks to
 * be aimed at, and in a list the row is what you aim at.
 */
export function ListChoiceRow({
  disabled,
  onSelect,
  selected,
  ...content
}: RowContent & {
  disabled?: boolean;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <button
      aria-checked={selected}
      className={cn(rowClass, disabled && "pointer-events-none opacity-50")}
      data-selected={selected}
      disabled={disabled}
      onClick={onSelect}
      role="radio"
      type="button"
    >
      <RowInner
        {...content}
        trailing={
          <Check
            aria-hidden
            className={cn(
              "size-4 shrink-0 text-[var(--tint-content)] transition-opacity duration-[var(--motion-control)]",
              selected ? "opacity-100" : "opacity-0",
            )}
          />
        }
      />
    </button>
  );
}

/** A value chosen from a menu, wearing the row rather than a bordered box. */
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
  options: Array<{ label: string; value: string }>;
  placeholder?: string;
  value: string;
}) {
  return (
    <Select disabled={disabled} onValueChange={onChange} value={value}>
      <SelectTrigger
        aria-label={label}
        className={cn(
          rowClass,
          "h-auto justify-between rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:border-transparent focus-visible:ring-0",
        )}
      >
        <span className="min-w-0 flex-1 text-left text-[0.9375rem] leading-6">{label}</span>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** A typed value that sits on the naming line instead of under it. */
export function ListInputRow({
  disabled,
  inputMode,
  label,
  maxLength,
  onChange,
  placeholder,
  value,
}: {
  disabled?: boolean;
  inputMode?: React.ComponentProps<"input">["inputMode"];
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className={cn(rowClass, "gap-4")}>
      <span className="min-w-0 flex-1 text-[0.9375rem] leading-6">{label}</span>
      <Input
        aria-label={label}
        className="h-9 w-[min(14rem,55%)] shrink-0"
        disabled={disabled}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

/**
 * A bounded number. It clamps when the field is left rather than while it is
 * being typed, so deleting a digit on the way to another one is allowed.
 */
export function ListNumberRow({
  label,
  max,
  min = 1,
  onChange,
  step = 1,
  unit,
  value,
}: {
  label: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  unit?: React.ReactNode;
  value?: number;
}) {
  const pending = value === undefined;
  return (
    <label className={cn(rowClass, "gap-4")}>
      <span className="min-w-0 flex-1 text-[0.9375rem] leading-6">{label}</span>
      <span className="flex shrink-0 items-center gap-2">
        <Input
          aria-busy={pending}
          aria-label={label}
          className="h-9 w-24 text-right tabular-nums"
          disabled={pending}
          inputMode="numeric"
          max={max}
          min={min}
          onBlur={(event) => {
            const parsed = Number(event.target.value);
            if (!Number.isFinite(parsed)) return;
            const lower = Math.max(min, parsed);
            onChange(max === undefined ? lower : Math.min(max, lower));
          }}
          onChange={(event) => onChange(Number(event.target.value))}
          step={step}
          type="number"
          value={Number.isFinite(value) ? value : ""}
        />
        {unit ? (
          <span className="w-8 text-xs text-muted-foreground">{unit}</span>
        ) : null}
      </span>
    </label>
  );
}

/**
 * A sentence rather than a value: the one row that stacks, because what is
 * written here is prose and has to be read back at the width it was typed.
 */
export function ListNoteRow({
  label,
  maxLength,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className={cn(rowClass, "flex-col items-stretch gap-2")}>
      <span className="text-[0.9375rem] leading-6">{label}</span>
      <Textarea
        aria-label={label}
        className="min-h-24"
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? label}
        value={value}
      />
    </label>
  );
}
