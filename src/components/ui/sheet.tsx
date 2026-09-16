"use client";

import * as React from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { timingMs } from "@/lib/motion-timing";
import { cn } from "@/lib/utils";

export const sheetCloseButtonClass = "size-11 shrink-0 md:size-9";

/**
 * The one sheet surface used throughout the product.
 *
 * Dialog still owns the Radix mechanics and centred-dialog presentation. A
 * sheet adds the mobile full-height contract and the shared close control, so a
 * feature cannot quietly grow a second generation of sheet chrome around the
 * same primitive.
 */
const SheetLifecycle = React.createContext<{
  closing: boolean;
  completeClose: () => void;
  requestClose: () => void;
} | null>(null);

/**
 * Keep the visual sheet alive for its departure before telling a controlled
 * parent that it is closed. Record-backed sheets commonly clear their selected
 * value in `onOpenChange(false)`; forwarding that immediately lets React remove
 * the subtree before Radix can hold `data-state="closed"` for the CSS exit.
 */
function Sheet({
  defaultOpen,
  onOpenChange,
  open,
  ...props
}: React.ComponentProps<typeof Dialog>) {
  const controlled = open !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false);
  const [closing, setClosing] = React.useState(false);
  const pendingCloseRef = React.useRef(false);
  const fallbackTimerRef = React.useRef<number | null>(null);
  const sourceOpen = controlled ? Boolean(open) : internalOpen;
  const visualOpen = sourceOpen;

  const clearFallback = React.useCallback(() => {
    if (fallbackTimerRef.current === null) return;
    window.clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = null;
  }, []);

  const completeClose = React.useCallback(() => {
    if (!pendingCloseRef.current) return;
    pendingCloseRef.current = false;
    clearFallback();
    if (!controlled) setInternalOpen(false);
    onOpenChange?.(false);
  }, [clearFallback, controlled, onOpenChange]);

  React.useEffect(() => {
    if (!controlled || open) return;
    pendingCloseRef.current = false;
    clearFallback();
    setClosing(false);
  }, [clearFallback, controlled, open]);

  React.useEffect(() => () => clearFallback(), [clearFallback]);

  const requestClose = React.useCallback(() => {
    if (pendingCloseRef.current) return;
    const mobileSheet = window.matchMedia("(max-width: 47.99rem)").matches;
    if (!mobileSheet) {
      if (!controlled) setInternalOpen(false);
      onOpenChange?.(false);
      return;
    }

    pendingCloseRef.current = true;
    setClosing(true);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.requestAnimationFrame(completeClose);
      return;
    }

    // AnimationEnd is the normal path. This only prevents a parent from being
    // held open forever if a browser cancels the CSS animation mid-flight.
    fallbackTimerRef.current = window.setTimeout(
      completeClose,
      timingMs("sheetExit") + 80,
    );
  }, [completeClose, controlled, onOpenChange]);

  const change = React.useCallback((next: boolean) => {
    if (next) {
      pendingCloseRef.current = false;
      clearFallback();
      setClosing(false);
      if (!controlled) setInternalOpen(true);
      onOpenChange?.(true);
      return;
    }
    requestClose();
  }, [clearFallback, controlled, onOpenChange, requestClose]);

  return (
    <SheetLifecycle.Provider value={{ closing, completeClose, requestClose }}>
      <Dialog {...props} open={visualOpen} onOpenChange={change} />
    </SheetLifecycle.Provider>
  );
}

const SheetClose = DialogClose;
const SheetDescription = DialogDescription;
const SheetFooter = DialogFooter;
const SheetHeader = DialogHeader;
const SheetTitle = DialogTitle;
const SheetTrigger = DialogTrigger;

type SheetContentProps = Omit<
  React.ComponentProps<typeof DialogContent>,
  "presentation"
>;

function SheetContent({
  children,
  className,
  onAnimationEnd,
  showCloseButton = true,
  ...props
}: SheetContentProps) {
  const { t } = useI18n();
  const lifecycle = React.useContext(SheetLifecycle);

  return (
    <DialogContent
      className={cn(
        "gap-2",
        className,
      )}
      onSheetExitComplete={lifecycle?.completeClose}
      presentation="sheet"
      sheetClosing={Boolean(lifecycle?.closing)}
      showCloseButton={false}
      {...props}
      onAnimationEnd={(event) => {
        onAnimationEnd?.(event);
        if (event.currentTarget !== event.target) return;
        if (
          event.animationName === "t-sheet-out" ||
          event.animationName === "t-sheet-dismiss" ||
          event.animationName === "t-dialog-out"
        ) {
          lifecycle?.completeClose();
        }
      }}
    >
      {children}
      {showCloseButton ? (
        <Button
          aria-label={t("common.close")}
          className={cn(
            "absolute right-(--dialog-pad) top-(--dialog-pad) z-30",
            sheetCloseButtonClass,
          )}
          data-slot="dialog-close"
          onClick={() => lifecycle?.requestClose()}
          size="icon"
          type="button"
          variant="ghost"
        >
          <X />
          <span className="sr-only">{t("common.close")}</span>
        </Button>
      ) : (
        <button
          aria-hidden
          className="sr-only"
          data-slot="dialog-close"
          onClick={() => lifecycle?.requestClose()}
          tabIndex={-1}
          type="button"
        />
      )}
    </DialogContent>
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
