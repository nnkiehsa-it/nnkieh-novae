"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useShareExitGuard } from "@/hooks/use-share-entry";
import { Sheet } from "@/ui/sheet";

interface RecordFrame {
  /** Leaves the record: puts the sheet away, or goes to the list it is in. */
  close: () => void;
  /** Where a page with no history behind it leads back to. */
  listHref: string;
  mode: "page" | "sheet";
}

const RecordFrameContext = React.createContext<RecordFrame | null>(null);

/** How the record on screen is framed, for the controls that leave it. */
export function useRecordFrame(): RecordFrame {
  const frame = React.useContext(RecordFrameContext);
  if (!frame) throw new Error("useRecordFrame must be used inside RecordSheet or RecordPage");
  return frame;
}

/**
 * A record or composer opened from a list: it slides up over the list, which
 * stays where it was, and closing it steps back through history.
 */
export function RecordSheet({ children, listHref, size = "lg", title }: {
  children: React.ReactNode;
  listHref: string;
  size?: "md" | "lg";
  title: string;
}) {
  const router = useRouter();
  const guard = useShareExitGuard();
  const [open, setOpen] = React.useState(true);
  const frame = React.useMemo<RecordFrame>(() => ({
    close: () => guard(() => setOpen(false)),
    listHref,
    mode: "sheet",
  }), [guard, listHref]);
  return (
    <RecordFrameContext.Provider value={frame}>
      <Sheet
        onClosed={() => router.back()}
        onOpenChange={(next) => { if (!next) frame.close(); }}
        open={open}
        size={size}
        title={title}
      >
        {children}
      </Sheet>
    </RecordFrameContext.Provider>
  );
}

/** A record reached by its own URL: a full page that leads back to its list. */
export function RecordPage({ children, listHref }: { children: React.ReactNode; listHref: string }) {
  const router = useRouter();
  const guard = useShareExitGuard();
  const frame = React.useMemo<RecordFrame>(() => ({
    close: () => guard(() => router.push(listHref)),
    listHref,
    mode: "page",
  }), [guard, listHref, router]);
  return (
    <RecordFrameContext.Provider value={frame}>
      <div className="mx-auto w-full max-w-3xl">{children}</div>
    </RecordFrameContext.Provider>
  );
}
