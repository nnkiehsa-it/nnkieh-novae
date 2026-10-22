import type * as React from "react";
import { Button, type ActionStatus } from "./button";
import { ListGroup } from "./list";
import { ChoiceRow, NoteRow } from "./list-controls";
import { Sheet } from "./sheet";

export interface DecisionOption {
  disabled?: boolean;
  label: string;
  tone?: "default" | "danger";
  value: string;
}

/** The sentence a decision is recorded with, when it asks for one. */
interface DecisionNote {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}

interface DecisionProps {
  /** Rows between the outcomes and the note. */
  children?: React.ReactNode;
  note?: DecisionNote;
  onSubmit: () => void;
  onValueChange: (value: string) => void;
  options: readonly DecisionOption[];
  status?: ActionStatus;
  /** Whether the decision can be carried out, beyond the note being written. */
  submittable?: boolean;
  submitLabel: string;
  title?: string;
  value: string;
}

/**
 * One decision, made once: choose an outcome, say why, carry it out. Ruling on
 * a proposal, closing a facility report and restricting an account share it.
 */
function DecisionForm({ children, note, onSubmit, onValueChange, options, status = "idle", submittable = true, submitLabel, title, value }: DecisionProps) {
  const danger = options.find((option) => option.value === value)?.tone === "danger";
  const ready = submittable && (!note?.required || note.value.trim().length > 0);
  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready && status === "idle") onSubmit();
      }}
    >
      <ListGroup role="radiogroup" title={title}>
        {options.map((option) => (
          <ChoiceRow
            disabled={option.disabled}
            key={option.value}
            label={option.label}
            onSelect={() => onValueChange(option.value)}
            selected={value === option.value}
            tone={option.tone}
          />
        ))}
        {children}
        {note ? <NoteRow label={note.label} maxLength={500} onChange={note.onChange} placeholder={note.placeholder} value={note.value} /> : null}
      </ListGroup>
      <Button className="w-full" disabled={!ready} status={status} type="submit" variant={danger ? "danger" : "primary"}>
        {submitLabel}
      </Button>
    </form>
  );
}

export function DecisionSheet({ onOpenChange, open, sheetTitle, ...decision }: DecisionProps & {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  sheetTitle: string;
}) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open} title={sheetTitle}>
      <DecisionForm {...decision} />
    </Sheet>
  );
}
