import * as React from "react";
import { useAppNavigate } from "@/hooks/use-app-location";
import { useShareExitGuard } from "@/hooks/use-share-entry";
import { canStepBack } from "@/lib/app-navigation";
import { Sheet } from "@/ui/sheet";

interface RecordFrame {
  /** Leaves the record for the list it sits in. */
  close: () => void;
  /** The list the record sits in. */
  listHref: string;
}

const RecordFrameContext = React.createContext<RecordFrame | null>(null);

/**
 * A record or composer over the list it belongs to. The address decides
 * whether it is open; leaving steps back through history when the list is
 * behind it, and replaces the address with the list when the record was the
 * first thing opened.
 */
export function RecordSheet({ children, listHref, onClosed, open, title }: {
  children: React.ReactNode;
  listHref: string;
  /** Called once the sheet has finished leaving. */
  onClosed: () => void;
  open: boolean;
  title: string;
}) {
  const navigate = useAppNavigate();
  const guard = useShareExitGuard();
  const frame = React.useMemo<RecordFrame>(() => ({
    close: () => guard(() => {
      if (canStepBack()) window.history.back();
      else navigate(listHref, { replace: true });
    }),
    listHref,
  }), [guard, listHref, navigate]);
  return (
    <RecordFrameContext.Provider value={frame}>
      <Sheet
        layout="record"
        onClosed={onClosed}
        onOpenChange={(next) => { if (!next) frame.close(); }}
        open={open}
        size="screen"
        title={title}
      >
        {children}
      </Sheet>
    </RecordFrameContext.Provider>
  );
}
