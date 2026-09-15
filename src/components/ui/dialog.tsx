"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import { timingMs } from "@/lib/motion-timing";
import { holdStageBehind } from "@/lib/stage-depth";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  sheet = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay> & { sheet?: boolean }) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "t-overlay fixed inset-0 z-50 bg-[var(--backdrop)] backdrop-blur-[3px]",
        sheet && "t-sheet-overlay",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  surface = "floating",
  presentation = "centered",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  surface?: "floating" | "plain";
  presentation?: "centered" | "sheet";
}) {
  const sheet = presentation === "sheet";
  const { t } = useI18n();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{ startedAt: number; startedY: number } | null>(null);
  const settleTimerRef = React.useRef<number | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [settling, setSettling] = React.useState(false);
  const [dismissing, setDismissing] = React.useState(false);
  const [dragInteracted, setDragInteracted] = React.useState(false);

  React.useEffect(() => () => {
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
  }, []);

  const resetSheetPosition = React.useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    setDragging(false);
    setSettling(true);
    window.requestAnimationFrame(() => content.style.removeProperty("--sheet-drag-y"));
    settleTimerRef.current = window.setTimeout(() => setSettling(false), timingMs("control"));
  }, []);

  const beginSheetDrag = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!sheet || !window.matchMedia("(max-width: 47.99rem)").matches) return;
    const target = event.target instanceof Element ? event.target : null;
    const dragRegion = target?.closest("[data-sheet-drag-region],.detail-header");
    const interactiveControl = target?.closest("button,a,input,textarea,select,[role='button']");
    if (!dragRegion || interactiveControl) return;
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    setSettling(false);
    setDragInteracted(true);
    setDragging(true);
    dragRef.current = { startedAt: performance.now(), startedY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [sheet]);

  const moveSheetDrag = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const content = contentRef.current;
    if (!drag || !content) return;
    content.style.setProperty("--sheet-drag-y", `${Math.max(0, event.clientY - drag.startedY)}px`);
  }, []);

  const endSheetDrag = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const content = contentRef.current;
    if (!drag || !content) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const distance = Math.max(0, event.clientY - drag.startedY);
    const velocity = distance / Math.max(1, performance.now() - drag.startedAt);
    if (distance >= Math.min(window.innerHeight * 0.22, 160) || velocity >= 0.65) {
      setDragging(false);
      setDismissing(true);
      content.style.setProperty("--sheet-dismiss-from", `${distance}px`);
      content.querySelector<HTMLElement>("[data-slot='dialog-close']")?.click();
      return;
    }
    resetSheetPosition();
  }, [resetSheetPosition]);

  const cancelSheetDrag = React.useCallback(() => {
    dragRef.current = null;
    resetSheetPosition();
  }, [resetSheetPosition]);

  // A sheet is a layer over the page, so the page reads as a layer: it becomes
  // one screen-sized card and is pushed back behind the sheet. What that costs
  // is the two figures the card is rebuilt from, taken before it moves.
  React.useLayoutEffect(() => (sheet ? holdStageBehind() : undefined), [sheet]);

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay sheet={sheet} />
      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-50 grid items-center justify-items-center p-4",
          sheet && "max-md:items-end max-md:justify-items-stretch max-md:p-0",
        )}
      >
        <DialogPrimitive.Content
          ref={contentRef}
          data-slot="dialog-content"
          data-sheet-dragging={dragging || undefined}
          data-sheet-drag-interacted={dragInteracted || undefined}
          data-sheet-settling={settling || undefined}
          data-sheet-dismissing={dismissing || undefined}
          className={cn(
            "t-dialog pointer-events-auto relative grid max-h-[90svh] w-full min-w-0 max-w-[min(92vw,88rem)] gap-5 overflow-x-clip overflow-y-auto p-(--dialog-pad) outline-none [--dialog-pad:1.5rem] sm:[--dialog-pad:1.75rem] [&>*]:min-w-0",
            surface === "floating"
              ? "surface-floating"
              : "rounded-[var(--radius-xl)] bg-popover",
            sheet && "t-sheet",
            className,
          )}
          {...props}
          onPointerCancel={cancelSheetDrag}
          onPointerDown={beginSheetDrag}
          onPointerMove={moveSheetDrag}
          onPointerUp={endSheetDrag}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              className="absolute top-3 right-3 z-30 grid size-8 place-items-center rounded-full bg-muted text-muted-foreground transition-[background-color,color] duration-[var(--motion-control)] hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-4"
            >
              <XIcon />
              <span className="sr-only">{t("common.close")}</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </div>
    </DialogPortal>
  );
}

function DialogHeader({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-sheet-drag-region=""
      data-slot="dialog-header"
      className={cn("t-sheet-drag-region text-left", className)}
      {...props}
    >
      <div className="flex min-h-9 flex-col justify-center gap-2 pr-10">
        {children}
      </div>
    </div>
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
