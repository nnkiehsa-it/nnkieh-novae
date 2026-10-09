"use client";

import { useEffect, useRef, type ReactNode, type ComponentProps } from "react";
import { Button, Icon, Link, ListItem, f7 } from "framework7-react";
import type { SmartSelect } from "framework7/types";
import { useI18n } from "@/i18n";
import { useCompactViewport } from "./use-compact-viewport";
import { cn } from "@/lib/utils";
import { useFramework7Control, useFramework7ListControl } from "./use-framework7-control";
import { topNativeModal } from "./native-modal-layers";

const smartSelectEvents: SmartSelect.Parameters["on"] = {
  open: (select) => select.el.setAttribute("aria-expanded", "true"),
  opened: (select) => {
    const modal = topNativeModal()!;
    modal.setAttribute("aria-label", select.params.pageTitle!);
    modal.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach((input) =>
      input.setAttribute("aria-label", input.closest("label")!.querySelector(".item-title")!.textContent!),
    );
  },
  closed: (select) => select.el.setAttribute("aria-expanded", "false"),
};

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
      on: smartSelectEvents,
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
      {controlLabel !== "toolbar" ? <Icon f7="chevron_down" size={16} aria-hidden /> : null}
    </>
  );
  const attributes = {
    "aria-label": ariaLabel,
    "aria-current": ariaCurrent,
    "aria-haspopup": "dialog" as const,
    "aria-expanded": false,
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
    "aria-expanded": "false",
    "aria-disabled": disabled,
  });
  return (
    <ListItem
      key={compact ? "sheet" : "popover"}
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
        on: smartSelectEvents,
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
