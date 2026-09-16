"use client";

import * as React from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SheetSurface } from "@/components/ui/sheet-surface";
import { useI18n } from "@/i18n";
import { timingMs } from "@/lib/motion-timing";
import { cn } from "@/lib/utils";

export const sheetCloseButtonClass = "size-11 shrink-0 md:size-9";

type SheetLifecycleValue = {
  closing: boolean;
  completeClose: () => void;
  requestClose: () => void;
};

const SheetLifecycle = React.createContext<SheetLifecycleValue | null>(null);

/**
 * The one sheet root used throughout the product.
 *
 * A sheet keeps its Radix surface mounted until the mobile departure finishes.
 * This matters both for a close requested by the primitive and for a controlled
 * parent that flips `open` to false itself. Without the retained presentation,
 * React can remove record-backed content between two frames and cut the exit
 * animation off completely.
 */
function Sheet({
  defaultOpen,
  onOpenChange,
  open,
  ...props
}: React.ComponentProps<typeof Dialog>) {
  const controlled = open !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false);
  const sourceOpen = controlled ? Boolean(open) : internalOpen;
  const [present, setPresent] = React.useState(sourceOpen);
  const [closing, setClosing] = React.useState(false);
  const previousSourceOpenRef = React.useRef(sourceOpen);
  const pendingCloseRef = React.useRef(false);
  const notifyParentRef = React.useRef(false);
  const fallbackTimerRef = React.useRef<number | null>(null);

  const clearFallback = React.useCallback(() => {
    if (fallbackTimerRef.current === null) return;
    window.clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = null;
  }, []);

  const cancelClose = React.useCallback(() => {
    pendingCloseRef.current = false;
    notifyParentRef.current = false;
    clearFallback();
    setClosing(false);
  }, [clearFallback]);

  const completeClose = React.useCallback(() => {
    if (!pendingCloseRef.current) return;
    const notifyParent = notifyParentRef.current;
    pendingCloseRef.current = false;
    notifyParentRef.current = false;
    clearFallback();
    setClosing(false);
    setPresent(false);
    if (!controlled) setInternalOpen(false);
    if (notifyParent) onOpenChange?.(false);
  }, [clearFallback, controlled, onOpenChange]);

  const beginMobileClose = React.useCallback((notifyParent: boolean) => {
    if (pendingCloseRef.current) {
      notifyParentRef.current ||= notifyParent;
      return;
    }
    pendingCloseRef.current = true;
    notifyParentRef.current = notifyParent;
    setClosing(true);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.requestAnimationFrame(completeClose);
      return;
    }

    // AnimationEnd is the normal path. The timer only prevents a browser that
    // cancels CSS animation events from leaving an invisible sheet mounted.
    fallbackTimerRef.current = window.setTimeout(
      completeClose,
      timingMs("sheetExit") + 80,
    );
  }, [completeClose]);

  const requestClose = React.useCallback(() => {
    if (pendingCloseRef.current) return;
    if (!window.matchMedia("(max-width: 47.99rem)").matches) {
      setPresent(false);
      if (!controlled) setInternalOpen(false);
      onOpenChange?.(false);
      return;
    }
    beginMobileClose(true);
  }, [beginMobileClose, controlled, onOpenChange]);

  // Controlled sheets can also be closed from feature state, not only through
  // Radix. Treat that falling edge as the same retained exit rather than making
  // controlled callers reimplement animation timing.
  React.useEffect(() => {
    const previousSourceOpen = previousSourceOpenRef.current;
    previousSourceOpenRef.current = sourceOpen;

    if (sourceOpen) {
      if (!previousSourceOpen || !present) {
        cancelClose();
        setPresent(true);
      }
      return;
    }

    if (!previousSourceOpen || !present || pendingCloseRef.current) return;
    if (window.matchMedia("(max-width: 47.99rem)").matches) {
      beginMobileClose(false);
      return;
    }
    setPresent(false);
  }, [beginMobileClose, cancelClose, present, sourceOpen]);

  React.useEffect(() => () => clearFallback(), [clearFallback]);

  const change = React.useCallback((next: boolean) => {
    if (next) {
      cancelClose();
      setPresent(true);
      if (!controlled) setInternalOpen(true);
      onOpenChange?.(true);
      return;
    }
    requestClose();
  }, [cancelClose, controlled, onOpenChange, requestClose]);

  return (
    <SheetLifecycle.Provider value={{ closing, completeClose, requestClose }}>
      <Dialog {...props} open={sourceOpen || present} onOpenChange={change} />
    </SheetLifecycle.Provider>
  );
}

/** Request the owning sheet's retained close path. */
function useSheetClose() {
  return React.useContext(SheetLifecycle)?.requestClose ?? null;
}

function SheetCloseButton({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick" | "size" | "type" | "variant">) {
  const { t } = useI18n();
  const close = useSheetClose();
  if (!close) return null;
  return (
    <Button
      aria-label={t("common.close")}
      className={cn(sheetCloseButtonClass, className)}
      data-slot="dialog-close"
      onClick={close}
      size="icon"
      type="button"
      variant="ghost"
      {...props}
    >
      <X />
      <span className="sr-only">{t("common.close")}</span>
    </Button>
  );
}

const SheetDescription = DialogDescription;
const SheetTitle = DialogTitle;

function SheetHeader({
  children,
  className,
  ...props
}: React.ComponentProps<typeof DialogHeader>) {
  return (
    <DialogHeader className={className} data-sheet-drag-region="" {...props}>
      {children}
      <SheetCloseButton className="absolute right-(--dialog-pad) top-(--dialog-pad) z-30" />
    </DialogHeader>
  );
}

type SheetContentProps = Omit<
  React.ComponentProps<typeof SheetSurface>,
  "onSheetExitComplete" | "sheetClosing"
>;

function SheetContent({
  children,
  className,
  ...props
}: SheetContentProps) {
  const lifecycle = React.useContext(SheetLifecycle);

  return (
    <SheetSurface
      className={cn("gap-2", className)}
      onSheetExitComplete={lifecycle?.completeClose}
      sheetClosing={Boolean(lifecycle?.closing)}
      {...props}
    >
      {children}
    </SheetSurface>
  );
}

export {
  Sheet,
  SheetCloseButton,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  useSheetClose,
};
