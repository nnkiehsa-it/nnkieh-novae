"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { timingMs } from "@/lib/motion-timing";
import { beginSheetClose, holdStageBehind } from "@/lib/stage-depth";
import { cn } from "@/lib/utils";

export type SheetSurfaceProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
  onSheetExitComplete?: () => void;
  sheetClosing?: boolean;
  suppressEntrance?: boolean;
  surface?: "floating" | "plain";
};

/**
 * Internal visual/mechanical surface for Sheet.
 *
 * Feature code never imports this module. Sheet owns lifecycle and public
 * chrome; this surface owns only the shared mobile mechanics: stage depth,
 * drag-to-dismiss, stacked geometry, and the single arrival/departure frame.
 */
export function SheetSurface({
  children,
  className,
  onSheetExitComplete,
  sheetClosing = false,
  suppressEntrance = false,
  surface = "floating",
  ...props
}: SheetSurfaceProps) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const motionFrameRef = React.useRef<HTMLDivElement>(null);
  const releaseStageRef = React.useRef<(() => void) | null>(null);
  const dragRef = React.useRef<{ startedAt: number; startedY: number } | null>(null);
  const settleTimerRef = React.useRef<number | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [settling, setSettling] = React.useState(false);
  const [dismissing, setDismissing] = React.useState(false);
  const [arrived, setArrived] = React.useState(suppressEntrance);

  React.useEffect(() => () => {
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
  }, []);

  const resetSheetPosition = React.useCallback(() => {
    const frame = motionFrameRef.current;
    if (!frame) return;
    setDragging(false);
    setSettling(true);
    window.requestAnimationFrame(() => frame.style.removeProperty("--sheet-drag-y"));
    settleTimerRef.current = window.setTimeout(
      () => setSettling(false),
      timingMs("control"),
    );
  }, []);

  const beginSheetDrag = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!window.matchMedia("(max-width: 47.99rem)").matches) return;
    const target = event.target instanceof Element ? event.target : null;
    const dragRegion = target?.closest("[data-sheet-drag-region],.detail-header");
    const interactiveControl = target?.closest(
      "button,a,input,textarea,select,[role='button']",
    );
    if (!dragRegion || interactiveControl) return;
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    setSettling(false);
    setDragging(true);
    dragRef.current = { startedAt: performance.now(), startedY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const moveSheetDrag = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const frame = motionFrameRef.current;
    if (!drag || !frame) return;
    frame.style.setProperty(
      "--sheet-drag-y",
      `${Math.max(0, event.clientY - drag.startedY)}px`,
    );
  }, []);

  const endSheetDrag = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const frame = motionFrameRef.current;
    if (!drag || !frame) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const distance = Math.max(0, event.clientY - drag.startedY);
    const velocity = distance / Math.max(1, performance.now() - drag.startedAt);
    if (distance >= Math.min(window.innerHeight * 0.22, 160) || velocity >= 0.65) {
      setDragging(false);
      setDismissing(true);
      frame.style.setProperty("--sheet-dismiss-from", `${distance}px`);
      contentRef.current
        ?.querySelector<HTMLElement>("[data-slot='dialog-close']")
        ?.click();
      return;
    }
    resetSheetPosition();
  }, [resetSheetPosition]);

  const cancelSheetDrag = React.useCallback(() => {
    dragRef.current = null;
    resetSheetPosition();
  }, [resetSheetPosition]);

  const setContentRef = React.useCallback((node: HTMLDivElement | null) => {
    releaseStageRef.current?.();
    releaseStageRef.current = null;
    contentRef.current = node;
    if (node) releaseStageRef.current = holdStageBehind(node);
  }, []);

  React.useEffect(() => () => {
    releaseStageRef.current?.();
    releaseStageRef.current = null;
  }, []);

  React.useLayoutEffect(() => {
    if (!sheetClosing) return;
    const frame = motionFrameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;

    // Freeze the exact visible offset before replacing arrival/drag motion with
    // departure, so a close during an unfinished entrance never jumps upward.
    const currentTop = Math.max(0, frame.getBoundingClientRect().top);
    frame.style.setProperty("--sheet-dismiss-from", `${currentTop}px`);
    for (const animation of frame.getAnimations()) animation.cancel();
    beginSheetClose(content);
    frame.dataset.sheetLifecycleClosing = "true";
  }, [sheetClosing]);

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay
        className="t-sheet-overlay"
        data-sheet-lifecycle-closing={sheetClosing || undefined}
        data-sheet-suppress-entrance={suppressEntrance || undefined}
      />
      <div className="pointer-events-none fixed inset-0 z-50 grid items-center justify-items-center p-4 max-md:items-end max-md:justify-items-stretch max-md:p-0">
        <div
          ref={motionFrameRef}
          className="t-sheet-motion-frame pointer-events-none grid h-full w-full items-end justify-items-stretch md:contents"
          data-sheet-arrived={arrived || undefined}
          data-sheet-dismissing={dismissing || undefined}
          data-sheet-dragging={dragging || undefined}
          data-sheet-motion-frame=""
          data-sheet-settling={settling || undefined}
          data-sheet-suppress-entrance={suppressEntrance || undefined}
          onAnimationEnd={(event) => {
            if (event.currentTarget !== event.target) return;
            if (event.animationName === "t-sheet-in") {
              setArrived(true);
              return;
            }
            if (event.animationName === "t-sheet-out") {
              setDismissing(false);
              setSettling(false);
              dragRef.current = null;
              onSheetExitComplete?.();
            }
          }}
        >
          <DialogPrimitive.Content
            ref={setContentRef}
            data-slot="dialog-content"
            data-sheet-surface=""
            data-sheet-lifecycle-closing={sheetClosing || undefined}
            data-sheet-dragging={dragging || undefined}
            data-sheet-settling={settling || undefined}
            data-sheet-dismissing={dismissing || undefined}
            data-sheet-suppress-entrance={suppressEntrance || undefined}
            className={cn(
              "t-dialog t-sheet pointer-events-auto relative grid w-full min-w-0 content-start gap-5 overflow-x-clip overflow-y-auto p-(--dialog-pad) outline-none [&>*]:min-w-0",
              "max-w-[min(calc(100vw-2rem),88rem)] [--dialog-pad:var(--page-gutter)] md:h-[calc(100svh-2rem)] md:max-h-[calc(100svh-2rem)]",
              surface === "floating"
                ? "surface-floating"
                : "rounded-[var(--radius-xl)] bg-popover",
              className,
            )}
            {...props}
            onOpenAutoFocus={(event) => {
              setArrived(suppressEntrance);
              setDismissing(false);
              setSettling(false);
              dragRef.current = null;
              props.onOpenAutoFocus?.(event);
            }}
            onPointerCancel={cancelSheetDrag}
            onPointerDown={beginSheetDrag}
            onPointerMove={moveSheetDrag}
            onPointerUp={endSheetDrag}
            onAnimationEnd={(event) => {
              props.onAnimationEnd?.(event);
              if (event.currentTarget !== event.target) return;
              if (
                sheetClosing &&
                window.matchMedia("(min-width: 48rem)").matches &&
                event.animationName === "t-dialog-out"
              ) {
                onSheetExitComplete?.();
              }
            }}
            onAnimationStart={props.onAnimationStart}
          >
            {children}
          </DialogPrimitive.Content>
        </div>
      </div>
    </DialogPortal>
  );
}
