"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useOptimisticDetailHandoff } from "@/components/optimistic-detail-navigation";
import { useI18n } from "@/i18n";
import { useShareExitGuard } from "@/hooks/use-share-entry";
import { recordListPath } from "@/lib/route-hierarchy";
import {
  heldStageScrollY,
  restoreHeldStageAfterNavigation,
} from "@/lib/stage-depth";

import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetTitle,
  useSheetClose,
} from "@/components/ui/sheet";

/**
 * One retained route sheet for records and the proposal composer. Intercepted
 * navigation keeps its source page mounted; a direct record URL uses the same
 * sheet and closes to its list, never to unrelated browser history.
 */
const RouteOverlay = React.createContext<{ close: () => void; label: string | null } | null>(null);

/** How controls inside intercepted content put away their route sheet. */
export function useCloseRouteOverlay() {
  return React.useContext(RouteOverlay)?.close ?? null;
}

export function useRouteOverlayLabel() {
  return React.useContext(RouteOverlay)?.label ?? null;
}

function RouteSheetContext({ children, label }: { children: ReactNode; label: string | null }) {
  const close = useSheetClose();
  if (!close) return children;
  return <RouteOverlay.Provider value={{ close, label }}>{children}</RouteOverlay.Provider>;
}

export function DetailSheet({ children, label, overlayLabel = label, returnTo }: {
  children: ReactNode;
  label: string;
  overlayLabel?: string | null;
  returnTo?: string;
}) {
  const router = useRouter();
  const guardClose = useShareExitGuard();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(true);
  const [sourceScrollY] = React.useState(() => heldStageScrollY());
  const optimisticHandoff = useOptimisticDetailHandoff(pathname);
  const [suppressEntrance] = React.useState(optimisticHandoff);

  return (
    <Sheet
      onCloseRequest={guardClose}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          if (returnTo) {
            router.replace(returnTo, { scroll: false });
          } else {
            restoreHeldStageAfterNavigation(() => router.back());
          }
        }
      }}
      open={open}
    >
      <SheetContent
        className="grid-rows-[minmax(0,1fr)]"
        stageScrollY={sourceScrollY}
        suppressEntrance={suppressEntrance}
      >
        <SheetBody className="pb-0">
          <SheetTitle className="sr-only">{label}</SheetTitle>
          <RouteSheetContext label={overlayLabel}>{children}</RouteSheetContext>
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
