"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { timingMs } from "@/lib/motion-timing";

/**
 * A record shown over the list it was opened from.
 *
 * The address is the record's own, so it can be sent to somebody, opened from a
 * notification, reloaded or bookmarked — and all of those arrive at the whole
 * page instead, because the route this stands in for is a real one. What this
 * saves is the journey: the list underneath keeps its scroll and everything it
 * had loaded, and the record arrives as a layer over it rather than as a new
 * screen the reader has to come back from.
 *
 * Closing is a step back through history, which is what makes the browser's own
 * Back close it too. Leaving the address for last is what lets the sheet travel
 * back out: the route is what mounts this, so changing it first would take the
 * sheet off the screen between two frames.
 */
const CloseRecord = React.createContext<(() => void) | null>(null);

/**
 * How to put this record away, for the controls inside it. A record shown as a
 * whole page has no such thing: its back control goes back.
 */
export function useCloseRecord() {
  return React.useContext(CloseRecord);
}

export function DetailModal({ children, label }: { children: ReactNode; label: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(true);
  const close = React.useCallback(() => {
    setOpen(false);
    window.setTimeout(() => router.back(), timingMs("sheetExit"));
  }, [router]);

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) close();
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-4xl" presentation="sheet" showCloseButton={false}>
        <DialogTitle className="sr-only">{label}</DialogTitle>
        <CloseRecord.Provider value={close}>{children}</CloseRecord.Provider>
      </DialogContent>
    </Dialog>
  );
}
