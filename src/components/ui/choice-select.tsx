"use client";

import { useEffect, useRef, type ReactNode, type ComponentProps } from "react";
import { Button, Link, ListItem, f7 } from "framework7-react";
import type { SmartSelect } from "framework7/types";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/i18n";
import { useCompactViewport } from "./use-compact-viewport";
import { cn } from "@/lib/utils";
import { useFramework7Control, useFramework7ListControl } from "./use-framework7-control";

export interface ChoiceOption {
  disabled?: boolean;
  label: string;
  value: string;
}
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
  controlLabel?: "" | "heading" | "toolbar";
  disabled?: boolean;
  onValueChange: (value: string) => void;
  options: readonly ChoiceOption[];
  size?: "sm" | "default";
  title: string;
  trigger?: (selected: ChoiceOption | undefined) => ReactNode;
  value: string;
}) {
  const { t } = useI18n();
  const compact = useCompactViewport();
  const element = useFramework7Control<HTMLElement>(undefined, undefined, {
    disabled: controlLabel ? undefined : disabled,
    "aria-disabled": disabled,
  });
  const select = useRef<SmartSelect.SmartSelect | null>(null);
  useEffect(() => {
    select.current = f7.smartSelect.create({
      el: element.current.el!,
      openIn: compact ? "sheet" : "popover",
      setValueText: false,
      pageTitle: title,
      closeOnSelect: true,
      sheetBackdrop: true,
      sheetCloseLinkText: t("common.close"),
      routableModals: false,
      inputIconPosition: "end",
    });
    return () => {
      select.current?.close();
      select.current?.destroy();
      select.current = null;
    };
  }, [compact, element, t, title]);
  const selected = options.find((option) => option.value === value);
  const content = (
    <>
      <select
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => onValueChange(event.target.value)}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      {trigger ? trigger(selected) : selected?.label}
      {controlLabel !== "toolbar" ? <ChevronDown aria-hidden className="size-4" /> : null}
    </>
  );
  const attributes = {
    "aria-label": ariaLabel,
    "aria-current": ariaCurrent,
    "aria-haspopup": "dialog" as const,
    "data-slot": "select-trigger",
    "data-displayed-active": ariaCurrent === "page",
    "data-control-label": controlLabel,
    role: "combobox",
  };
  if (controlLabel)
    return (
      <Link
        {...attributes}
        ref={element as NonNullable<ComponentProps<typeof Link>["ref"]>}
        className={cn("smart-select", className)}
        style={controlLabel === "heading" ? { color: "inherit" } : undefined}
        iconOnly={controlLabel === "toolbar"}
        href="#"
        onClick={(event) => {
          event.preventDefault();
          if (!disabled) select.current!.open();
        }}
      >
        {content}
      </Link>
    );
  return (
    <Button
      {...attributes}
      ref={element}
      className={cn("smart-select", className)}
      type="button"
      disabled={disabled}
      small={size === "sm"}
      onClick={() => select.current!.open()}
    >
      {content}
    </Button>
  );
}

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
  const compact = useCompactViewport();
  const { t } = useI18n();
  const id = useFramework7ListControl({
    role: "combobox",
    "aria-label": label,
    "aria-haspopup": "dialog",
    "aria-disabled": disabled,
  });
  return (
    <ListItem
      id={id}
      title={label}
      after={
        options.find((option) => option.value === value)?.label ?? placeholder
      }
      disabled={disabled}
      smartSelect
      smartSelectParams={{
        openIn: compact ? "sheet" : "popover",
        closeOnSelect: true,
        sheetBackdrop: true,
        pageTitle: label,
        sheetCloseLinkText: t("common.close"),
        routableModals: false,
        inputIconPosition: "end",
      }}
    >
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option
            value={option.value}
            key={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
    </ListItem>
  );
}
