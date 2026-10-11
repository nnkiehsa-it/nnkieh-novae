"use client";

import type { ComponentProps, ReactNode } from "react";
import { ListInput, ListItem } from "framework7-react";
import { RotateCcw } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button } from "./button";
import { Switch } from "./switch";
import { listItemSlots, type RowContent } from "./list";
import { useFramework7Control, useFramework7ListControl } from "./use-framework7-control";

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
  return (
    <ListItem
      disabled={disabled}
      mediaItem={Boolean(content.detail)}
      onClick={(event) => {
        if (!disabled && !(event.target as Element).closest(".toggle"))
          onCheckedChange(!checked);
      }}
    >
      {listItemSlots(
        content,
        <Switch
          aria-label={name}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
        />,
      )}
    </ListItem>
  );
}
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
  const id = useFramework7ListControl({"aria-label": typeof content.label === "string" ? content.label : undefined}, "input");
  return (
    <ListItem
      radio
      id={id}
      radioIcon="end"
      checked={selected}
      disabled={disabled}
      onChange={onSelect}
      mediaItem={Boolean(content.detail)}
    >
      {listItemSlots(content)}
    </ListItem>
  );
}
export function ListInputRow({
  disabled,
  id,
  info,
  inputMode,
  label,
  maxLength,
  onChange,
  placeholder,
  value,
}: {
  disabled?: boolean;
  id?: string;
  info?: ReactNode;
  inputMode?: ComponentProps<"input">["inputMode"];
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const f7Ref = useFramework7Control<HTMLInputElement>(undefined, "input", {
    "aria-label": label,
  });
  return (
    <ListInput
      type="text"
      inputId={id}
      label={label}
      disabled={disabled}
      inputmode={inputMode}
      maxlength={maxLength}
      onInput={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      value={value}
      ref={f7Ref}
    >
      {info ? <span slot="info">{info}</span> : null}
    </ListInput>
  );
}
export function ListNumberRow({
  disabled = false,
  label,
  max,
  min = 1,
  onChange,
  onReset,
  step = 1,
  unit,
  value,
}: {
  disabled?: boolean;
  label: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  onReset?: () => void;
  step?: number;
  unit?: ReactNode;
  value?: number;
}) {
  const { t } = useI18n();
  const f7Ref = useFramework7Control<HTMLInputElement>(undefined, "input", {
    "aria-label": label,
  });
  return (
    <ListInput
      type="number"
      inputmode="numeric"
      label={label}
      disabled={disabled}
      max={max}
      min={min}
      step={step}
      value={Number.isFinite(value) ? value : ""}
      ref={f7Ref}
      onInput={(event) => onChange(Number(event.target.value))}
      onBlur={(event) => {
        const parsed = Number(event.target.value);
        if (!Number.isFinite(parsed)) return;
        const lower = Math.max(min, parsed);
        onChange(max === undefined ? lower : Math.min(max, lower));
      }}
    >
      {unit ? <span slot="info">{unit}</span> : null}
      {onReset ? (
        <Button
          slot="content-end"
          className="mr-4"
          aria-label={t("admin.resetField", { field: label })}
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault();
            onReset();
          }}
          size="icon-sm"
          variant="ghost"
        >
          <RotateCcw />
        </Button>
      ) : null}
    </ListInput>
  );
}
export function ListNoteRow({
  disabled,
  label,
  maxLength,
  onChange,
  placeholder,
  value,
}: {
  disabled?: boolean;
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const f7Ref = useFramework7Control<HTMLTextAreaElement>(
    undefined,
    "textarea",
    { "aria-label": label },
  );
  return (
    <ListInput
      type="textarea"
      resizable
      label={label}
      disabled={disabled}
      maxlength={maxLength}
      onInput={(event) => onChange(event.target.value)}
      placeholder={placeholder ?? label}
      value={value}
      ref={f7Ref}
    />
  );
}
