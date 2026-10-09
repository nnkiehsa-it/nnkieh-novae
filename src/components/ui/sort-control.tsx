"use client";

import { Icon } from "framework7-react";
import { ChoiceSelect, type ChoiceOption } from "./choice-select";

export function SortControl({ label, options, value, onChange, disabled, className }: {
  label: string; options: readonly ChoiceOption[]; value: string;
  onChange: (value: string) => void; disabled?: boolean; iconOnly?: boolean; className?: string;
}) {
  return <ChoiceSelect ariaLabel={label} controlLabel="toolbar" className={className}
    disabled={disabled} onValueChange={onChange} options={options} title={label}
    trigger={() => <Icon f7="arrow_up_arrow_down" aria-hidden="true" />} value={value} />;
}
