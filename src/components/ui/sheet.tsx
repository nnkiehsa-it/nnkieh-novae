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

  const beginClose = React.useCallback((notifyParent: boolean) => {
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
      timingMs(
        window.matchMedia("(max-width: 47.99rem)").matches
          ? "sheetExit"
          : "controlExit",
      ) + 80,
    );
  }, [completeClose]);

  const requestClose = React.useCallback(() => {
    if (pendingCloseRef.current) return;
    beginClose(true);
  }, [beginClose]);

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
    beginClose(false);
  }, [beginClose, cancelClose, present, sourceOpen]);

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
  onClick,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "type" | "variant">) {
  const { t } = useI18n();
  const close = useSheetClose();
  if (!close) return null;
  return (
    <Button
      {...props}
      aria-label={t("common.close")}
      className={cn(sheetCloseButtonClass, className)}
      data-slot="dialog-close"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) close();
      }}
      size="icon"
      type="button"
      variant="ghost"
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
      <SheetCloseButton className="absolute right-(--dialog-pad) top-0 z-30" />
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
      className={cn("grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden", className)}
      onSheetExitComplete={lifecycle?.completeClose}
      sheetClosing={Boolean(lifecycle?.closing)}
      {...props}
    >
      {children}
    </SheetSurface>
  );
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("min-h-0 overflow-y-auto overscroll-contain pb-1", className)}
      data-slot="sheet-body"
      {...props}
    />
  );
}

export {
  Sheet,
  SheetBody,
  SheetCloseButton,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  useSheetClose,
};
