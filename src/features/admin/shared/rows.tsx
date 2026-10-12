"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { ListRow, rowClass } from "@/ui/list";
import { Sheet } from "@/ui/sheet";

/** One field of a record: its name above its value, which wraps rather than being cut off. */
export function FieldRow({ label, mono = false, value }: { label: React.ReactNode; mono?: boolean; value: React.ReactNode }) {
  return (
    <li className={cn(rowClass, "flex-col items-start gap-1")}>
      <span className="text-sm text-ink-muted">{label}</span>
      <span className={cn("max-w-full text-base [overflow-wrap:anywhere]", mono && "font-mono text-sm")}>{value}</span>
    </li>
  );
}

/** A row that opens its record, with a second control at the trailing edge that does something to it. */
export function ActionableRow({ action, detail, disabled, label, onClick, value }: {
  action: React.ReactNode;
  detail?: React.ReactNode;
  disabled?: boolean;
  label: React.ReactNode;
  onClick: () => void;
  value?: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-1 pr-3">
      <ul className="min-w-0 flex-1">
        <ListRow detail={detail} disabled={disabled} label={label} onClick={onClick} value={value} />
      </ul>
      {action}
    </li>
  );
}

/** A row that opens what it names in a sheet. */
export function DetailRow({ children, detail, label, title, value }: {
  children: React.ReactNode;
  detail?: React.ReactNode;
  label: React.ReactNode;
  title: string;
  value?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <ListRow detail={detail} label={label} onClick={() => setOpen(true)} value={value} />
      <Sheet onOpenChange={setOpen} open={open} title={title}>{children}</Sheet>
    </>
  );
}

type PersonRowProps = {
  detail?: React.ReactNode;
  name: string;
  photoUrl?: string | null;
  value?: React.ReactNode;
} & (
  | { disabled?: boolean; onClick: () => void; trailing?: never }
  | { disabled?: never; onClick?: never; trailing?: React.ReactNode }
);

/** One person: their photo and name, what to know about them, and either a tap target or a trailing control. */
export function PersonRow({ detail, disabled, name, onClick, photoUrl, trailing, value }: PersonRowProps) {
  const identity = { detail, icon: <Avatar name={name} src={photoUrl} />, label: name, value };
  return onClick
    ? <ListRow {...identity} disabled={disabled} onClick={onClick} />
    : <ListRow {...identity} trailing={trailing} />;
}
