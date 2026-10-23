import * as React from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { Dialog } from "radix-ui";
import { X } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { timing } from "@/lib/motion-timing";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { useCompactViewport } from "./use-compact-viewport";

// How far, or how fast, the grabber has to be pulled before letting go puts the sheet away.
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.6;

/** Pulling the grabber down: the sheet follows the finger, and lets go either away or back home. */
function useGrabber(onDismiss: () => void) {
  const offset = useMotionValue(0);
  const start = React.useRef<{ time: number; y: number } | null>(null);
  const handlers = {
    onPointerCancel: () => { start.current = null; void animate(offset, 0, timing("control", "nav")); },
    onPointerDown: (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      start.current = { time: event.timeStamp, y: event.clientY };
    },
    onPointerMove: (event: React.PointerEvent) => {
      if (start.current) offset.set(Math.max(0, event.clientY - start.current.y));
    },
    onPointerUp: (event: React.PointerEvent) => {
      if (!start.current) return;
      const distance = event.clientY - start.current.y;
      const velocity = distance / Math.max(1, event.timeStamp - start.current.time);
      start.current = null;
      if (distance > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) onDismiss();
      else void animate(offset, 0, timing("control", "nav"));
    },
  };
  return { handlers, offset };
}

/**
 * A layer over the current page. On a phone it rises from the bottom edge on
 * the iOS presentation curve and is pulled away by its grabber; from the
 * tablet breakpoint up it is a centred panel that settles into place.
 * `layout="record"` gives a phone the whole screen for a record or composer.
 * Escape, the scrim, the grabber and the close button all route through
 * `onOpenChange`, so a caller guarding unsaved work sees every exit.
 */
export function Sheet({
  children,
  description,
  footer,
  layout = "sheet",
  onClosed,
  onOpenChange,
  open,
  size = "md",
  title,
}: {
  children: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  layout?: "record" | "sheet";
  /** Called once the closing animation has finished. */
  onClosed?: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** `lg` gives a composer room on a wide screen; `full` also holds a record's height while it loads. */
  size?: "md" | "lg" | "full";
  title: React.ReactNode;
}) {
  const { t } = useI18n();
  const compact = useCompactViewport();
  const grabber = useGrabber(() => onOpenChange(false));
  const scrimOpacity = useTransform(grabber.offset, [0, 480], [1, 0.2]);
  const pulled = useTransform(grabber.offset, (y) => `0 ${y}px`);
  const { offset } = grabber;

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <AnimatePresence onExitComplete={() => { offset.set(0); onClosed?.(); }}>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 bg-[var(--scrim)]"
                exit={{ opacity: 0, transition: timing("sheetExit", "nav") }}
                initial={{ opacity: 0 }}
                style={compact ? { opacity: scrimOpacity } : undefined}
                transition={timing("sheet", "nav")}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                animate={compact ? { y: 0 } : { opacity: 1, scale: 1 }}
                className={cn(
                  "fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-panel border-t border-line bg-surface-solid text-ink shadow-float outline-none",
                  layout === "record" ? "top-[calc(var(--safe-top)+0.75rem)]" : "max-h-[calc(100svh-var(--safe-top)-1.5rem)]",
                  "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-panel md:border",
                  size === "md" && "md:max-h-[min(44rem,calc(100svh-4rem))] md:w-[min(34rem,calc(100vw-4rem))]",
                  size !== "md" && "md:max-h-[min(56rem,calc(100svh-4rem))] md:w-[min(52rem,calc(100vw-4rem))]",
                  size === "full" && "md:h-[calc(100svh-4rem)]",
                )}
                data-sheet-surface=""
                exit={compact
                  ? { transition: timing("sheetExit", "nav"), y: "100%" }
                  : { opacity: 0, scale: 0.97, transition: timing("controlExit", "depart") }}
                initial={compact ? { y: "100%" } : { opacity: 0, scale: 0.96 }}
                style={compact ? { translate: pulled } : undefined}
                transition={compact ? timing("sheet", "nav") : timing("nav", "nav")}
              >
                <div className="flex min-h-0 flex-1 flex-col">
                  <header className="relative flex shrink-0 items-start gap-3 px-5 pb-2 pt-4 md:px-6 md:pt-5">
                    {compact ? (
                      <div aria-hidden className="absolute inset-x-0 top-0 flex h-8 touch-none cursor-grab justify-center pt-2" {...grabber.handlers}>
                        <span className="h-1.5 w-10 rounded-full bg-ink-faint/60" />
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1 pt-1.5">
                      <Dialog.Title className="text-base font-semibold md:text-lg">{title}</Dialog.Title>
                      {description ? (
                        <Dialog.Description className="mt-1 text-sm text-ink-muted">{description}</Dialog.Description>
                      ) : null}
                    </div>
                    <Dialog.Close asChild>
                      <Button aria-label={t("common.close")} className="relative" size="icon" variant="secondary"><X weight="bold" /></Button>
                    </Dialog.Close>
                  </header>
                  <div className="edge-fade min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,var(--safe-bottom))] pt-2 md:px-6 md:pb-6">{children}</div>
                  {footer ? (
                    <footer className="flex shrink-0 justify-end gap-2 border-t border-line px-5 pb-[max(1rem,var(--safe-bottom))] pt-4 md:px-6">{footer}</footer>
                  ) : null}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
