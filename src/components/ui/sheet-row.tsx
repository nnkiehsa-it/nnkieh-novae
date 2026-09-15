"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ListNavRow } from "@/components/ui/list";

/**
 * A row that opens what it names in a sheet.
 *
 * These used to be rows that opened downwards, pushing everything under them
 * to the bottom of the screen and asking a record -- a list of people, a
 * revision, a provider's whole reply -- to live inside a list it is not part
 * of. A row that leads somewhere leads somewhere: it carries a chevron, and
 * what it names arrives over the page and leaves the way it came.
 */
export function SheetRow({
  children,
  label,
  onOpenChange,
  title,
  value,
}: {
  children: React.ReactNode;
  label: React.ReactNode;
  /** Told each time the sheet opens, so content can be fetched only once asked for. */
  onOpenChange?: (open: boolean) => void;
  title: string;
  /** What the row reports while the sheet is closed. */
  value?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const change = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };
  return (
    <>
      <ListNavRow label={label} onClick={() => change(true)} value={value} />
      <Dialog onOpenChange={change} open={open}>
        <DialogContent presentation="sheet">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    </>
  );
}
