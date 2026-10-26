import type * as React from "react";
import { Pane, useStepDirection } from "@/ui/pane";
import { Segmented } from "@/ui/segmented";

interface AdminSectionTab<Value extends string> {
  /** What the section is for, read under the tabs while it is selected. */
  detail?: string;
  label: string;
  unsaved?: boolean;
  value: Value;
}

/**
 * The views of one admin screen, with a sentence on what the selected one
 * covers, and the selected view's content beneath. The content slides in from
 * the side of the tab the reader moved to; what the screen keeps across views
 * (a draft bar, a sheet) stays outside it, beside the tabs.
 */
export function SectionTabs<Value extends string>({ children, label, onChange, sections, value }: {
  children: React.ReactNode;
  label: string;
  onChange: (value: Value) => void;
  sections: readonly AdminSectionTab<Value>[];
  value: Value;
}) {
  const detail = sections.find((section) => section.value === value)?.detail;
  const direction = useStepDirection(value, sections.findIndex((section) => section.value === value));
  return (
    <>
      <div className="grid gap-3">
        <Segmented
          className="justify-self-start"
          label={label}
          onChange={onChange}
          options={sections.map((section) => ({
            icon: section.unsaved ? <span className="size-1.5 rounded-full bg-caution" /> : undefined,
            label: section.label,
            value: section.value,
          }))}
          value={value}
        />
        {detail ? <p className="max-w-2xl px-1 text-sm leading-relaxed text-ink-muted">{detail}</p> : null}
      </div>
      <Pane className="grid min-w-0 gap-6" direction={direction} step={value}>{children}</Pane>
    </>
  );
}
