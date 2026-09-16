"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useOptimisticDetailHandoff } from "@/components/optimistic-detail-navigation";
import { useI18n } from "@/i18n";
import { recordListPath } from "@/lib/route-hierarchy";
import { useShareExitGuard } from "@/hooks/use-share-entry";

import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetTitle,
  useSheetClose,
} from "@/components/ui/sheet";

/**
 * One record presentation for every entry point. Intercepted navigation keeps
 * its source page mounted; a direct URL uses the same sheet and closes to the
 * record's list, never to an unrelated browser-history entry.
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

export function DetailSheet({ children, label, returnTo }: {
  children: ReactNode;
  label: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const guardClose = useShareExitGuard();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(true);
  const optimisticHandoff = useOptimisticDetailHandoff(pathname);
  const [suppressEntrance] = React.useState(optimisticHandoff);

  return (
    <Sheet
      onCloseRequest={guardClose}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          if (returnTo) router.replace(returnTo, { scroll: false });
          else router.back();
        }
      }}
      open={open}
    >
      <SheetContent
        className="grid-rows-[minmax(0,1fr)]"
        suppressEntrance={suppressEntrance}
      >
        <SheetBody className="pb-0">
          <SheetTitle className="sr-only">{label}</SheetTitle>
          <RecordSheetContext label={label}>{children}</RecordSheetContext>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

/** A route layout retains the sheet while its loading boundary resolves. */
export function DirectDetailSheet({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const label = pathname.startsWith("/issues/") ? "ui.nav.issues"
    : pathname.startsWith("/facilities/") ? "ui.nav.facilities"
      : "ui.nav.announcements";
  return (
    <DetailSheet label={t(label)} returnTo={recordListPath(pathname)}>
      {children}
    </DetailSheet>
  );
}
