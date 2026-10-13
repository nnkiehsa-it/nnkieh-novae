"use client";

import * as React from "react";
import { ArrowCounterClockwise, Check } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { rowClass } from "./list";
import { Select, type SelectOption } from "./select";
import { Switch } from "./switch";

const labelClass = "min-w-0 flex-1 text-base text-ink";
const inlineFieldClass =
  "h-10 rounded-tile border border-line bg-surface-raised px-3 text-[0.9375rem] text-ink outline-none placeholder:text-ink-faint focus:border-[var(--focus-ring)] disabled:opacity-40";

function RowLabel({ detail, label }: { detail?: React.ReactNode; label: React.ReactNode }) {
  return (
    <span className={labelClass}>
      <span className="block">{label}</span>
      {detail ? <span className="block text-sm text-ink-muted">{detail}</span> : null}
    </span>
  );
}

/** On or off; the whole row toggles. */
export function SwitchRow({ checked, detail, disabled, label, onChange }: {
  checked: boolean;
  detail?: React.ReactNode;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const id = React.useId();
  return (
    <li className={cn(rowClass, disabled && "opacity-40")}>
      <label className="flex min-w-0 flex-1 cursor-pointer" htmlFor={id}><RowLabel detail={detail} label={label} /></label>
      <Switch checked={checked} disabled={disabled} id={id} onCheckedChange={onChange} />
    </li>
  );
}

/** One of several; the selected row carries a check. Wrap the rows in a `radiogroup`. */
export function ChoiceRow({ detail, disabled, label, onSelect, selected, tone = "default" }: {
  detail?: React.ReactNode;
  disabled?: boolean;
  label: string;
  onSelect: () => void;
  selected: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <li>
      <button
        aria-checked={selected}
        className={cn(rowClass, "transition-[background-color] duration-[var(--motion-control)] ease-[var(--ease-move)] hover:bg-surface-raised disabled:opacity-40", tone === "danger" && "[&>span]:text-danger")}
        disabled={disabled}
        onClick={onSelect}
        role="radio"
        type="button"
      >
        <RowLabel detail={detail} label={label} />
        <Check aria-hidden className={cn("size-5 shrink-0 transition-opacity duration-[var(--motion-control)]", selected ? "opacity-100" : "opacity-0")} weight="bold" />
      </button>
    </li>
  );
}

/** A choice from a menu, read as the row's value. */
export function PickerRow<Value extends string>({ disabled, label, onChange, options, placeholder, value }: {
  disabled?: boolean;
  label: string;
  onChange: (value: Value) => void;
  options: readonly SelectOption<Value>[];
  placeholder?: string;
  value: Value | "";
}) {
  return (
    <li>
      <Select
        className={cn(rowClass, "transition-[background-color] duration-[var(--motion-control)] ease-[var(--ease-move)] hover:bg-surface-raised disabled:opacity-40")}
        disabled={disabled}
        label={label}
        onChange={onChange}
        options={options}
        renderTrigger={(selected) => (
          <>
            <span className={labelClass}>{label}</span>
            <span className={cn("max-w-[50%] truncate text-[0.9375rem]", selected ? "text-ink-muted" : "text-ink-faint")}>{selected?.label ?? placeholder}</span>
          </>
        )}
        value={value}
      />
    </li>
  );
}

/** A short typed value on the label's line. */
export function InputRow({ disabled, inputMode, label, maxLength, onChange, placeholder, value }: {
  disabled?: boolean;
  inputMode?: React.ComponentProps<"input">["inputMode"];
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <li>
      <label className={rowClass}>
        <span className={labelClass}>{label}</span>
        <input
          className={cn(inlineFieldClass, "w-[min(15rem,55%)]")}
          disabled={disabled}
          inputMode={inputMode}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          value={value}
        />
      </label>
    </li>
  );
}

/** A bounded number. It clamps when the field is left, so typing through an out-of-range value is allowed. */
export function NumberRow({ disabled, label, max, min = 1, onChange, onReset, step = 1, unit, value }: {
  disabled?: boolean;
  label: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  onReset?: () => void;
  step?: number;
  unit?: React.ReactNode;
  value?: number;
}) {
  const { t } = useI18n();
  return (
    <li className={rowClass}>
      <label className="flex min-w-0 flex-1 items-center gap-3">
        <span className={labelClass}>{label}</span>
        <input
          className={cn(inlineFieldClass, "w-24 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none")}
          disabled={disabled}
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
          value={value !== undefined && Number.isFinite(value) ? value : ""}
        />
      </label>
      {unit ? <span className="w-10 text-sm text-ink-muted">{unit}</span> : null}
      {onReset ? (
        <Button aria-label={t("admin.resetField", { field: label })} disabled={disabled} onClick={onReset} size="icon-sm" variant="ghost">
          <ArrowCounterClockwise weight="bold" />
        </Button>
      ) : null}
    </li>
  );
}

/** A sentence rather than a value: the one row that stacks. */
export function NoteRow({ disabled, label, maxLength, onChange, placeholder, value }: {
  disabled?: boolean;
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <li>
      <label className={cn(rowClass, "flex-col items-stretch gap-2")}>
        <span className={labelClass}>{label}</span>
        <textarea
          className={cn(inlineFieldClass, "min-h-24 resize-y py-2 leading-relaxed")}
          disabled={disabled}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder ?? label}
          value={value}
        />
      </label>
    </li>
  );
}
