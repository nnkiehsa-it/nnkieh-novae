"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetTitle,
  useSheetClose,
} from "@/components/ui/sheet";

/**
 * A record shown over the list it was opened from.
 *
 * The address is the record's own, so it can be sent to somebody, opened from a
 * notification, reloaded or bookmarked. Direct arrivals render the whole page;
 * intercepted navigation keeps the list underneath and presents the record as
 * the same shared sheet used everywhere else.
 */
const RecordOverlay = React.createContext<{ close: () => void; label: string } | null>(null);

/** How controls inside a record put away an intercepted record sheet. */
export function useCloseRecord() {
  return React.useContext(RecordOverlay)?.close ?? null;
}

export function useRecordOverlayLabel() {
  return React.useContext(RecordOverlay)?.label ?? null;
}

function RecordSheetContext({ children, label }: { children: ReactNode; label: string }) {
  const close = useSheetClose();
  if (!close) return children;
  return <RecordOverlay.Provider value={{ close, label }}>{children}</RecordOverlay.Provider>;
}

export function DetailSheet({ children, label }: { children: ReactNode; label: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(true);

  return (
    <Sheet
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) router.back();
      }}
      open={open}
    >
      <SheetContent className="grid-rows-[minmax(0,1fr)]">
        <SheetBody className="pb-0">
          <SheetTitle className="sr-only">{label}</SheetTitle>
          <RecordSheetContext label={label}>{children}</RecordSheetContext>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
