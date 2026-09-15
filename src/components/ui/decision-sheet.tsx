"use client";

import type * as React from "react";

import { useI18n as useLocaleSubscription } from "@/i18n";
import { ActionFeedbackIcon } from "@/components/ui/action-feedback-icon";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ListSection } from "@/components/ui/list";
import { ListChoiceRow, ListNoteRow } from "@/components/ui/list-controls";

export interface DecisionOption {
  disabled?: boolean;
  label: string;
  tone?: "default" | "destructive";
  value: string;
}

/** The sentence a decision is recorded with, when it asks for one. */
export interface DecisionNote {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}

interface DecisionProps {
  busy?: boolean;
  /** Rows the decision adds between the outcomes and the sentence. */
  children?: React.ReactNode;
  feedback?: "idle" | "loading" | "success";
  note?: DecisionNote;
  onSubmit: () => void;
  onValueChange: (value: string) => void;
  options: readonly DecisionOption[];
  sectionHeader?: string;
  /** Whether the decision can be carried out beyond the note being written. */
  submittable?: boolean;
  submitLabel: string;
  value: string;
}

/**
 * One decision, made once.
 *
 * Restricting an account, ruling on a proposal and closing a facility report
 * are the same act — choose an outcome, say why, carry it out — so they are one
 * shape: the outcomes as choice rows, the sentence as the last row, and a
 * single control underneath that is the only thing that writes anything.
 */
export function DecisionForm({
  busy = false,
  children,
  feedback = "idle",
  note,
  onSubmit,
  onValueChange,
  options,
  sectionHeader,
  submittable = true,
  submitLabel,
  value,
}: DecisionProps) {
  useLocaleSubscription();
  const destructive = options.find((option) => option.value === value)?.tone === "destructive";
  const ready = submittable && (!note?.required || note.value.trim().length > 0);
  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready && !busy) onSubmit();
      }}
    >
      <ListSection header={sectionHeader}>
        {options.map((option) => (
          <ListChoiceRow
            disabled={option.disabled}
            key={option.value}
            label={option.label}
            onSelect={() => onValueChange(option.value)}
            selected={value === option.value}
            tone={option.tone ?? "default"}
          />
        ))}
        {children}
        {note ? (
          <ListNoteRow
            label={note.label}
            maxLength={500}
            onChange={note.onChange}
            placeholder={note.placeholder}
            value={note.value}
          />
        ) : null}
      </ListSection>
      <Button
        className="w-full"
        disabled={busy || !ready}
        type="submit"
        variant={destructive ? "destructive" : "default"}
      >
        {busy ? (
          <ActionFeedbackIcon
            className="bg-transparent [&>svg]:size-5"
            size="md"
            state={feedback === "success" ? "success" : "loading"}
          />
        ) : null}
        {submitLabel}
      </Button>
    </form>
  );
}

/**
 * A decision that arrives as a sheet.
 *
 * The content stays mounted while it is closing, which is what lets the sheet
 * leave along the edge it arrived on instead of disappearing.
 */
export function DecisionSheet({
  onOpenChange,
  open,
  title,
  ...decision
}: DecisionProps & {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <DecisionForm {...decision} />
      </SheetContent>
    </Sheet>
  );
}
