"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Dialog } from "radix-ui";
import { X } from "@phosphor-icons/react/ssr";
import { timing } from "@/lib/motion-timing";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * A layer over the current page: a bottom sheet on a phone, a centred panel
 * from the tablet breakpoint up. Escape, the scrim and the close button all
 * route through `onOpenChange`, so a caller guarding unsaved work sees every exit.
 */
export function Sheet({
  children,
  closeLabel,
  description,
  footer,
  onOpenChange,
  open,
  title,
}: {
  children: React.ReactNode;
  closeLabel: string;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: React.ReactNode;
}) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 bg-[var(--scrim)]"
                exit={{ opacity: 0, transition: timing("sheetExit", "depart") }}
                initial={{ opacity: 0 }}
                transition={timing("sheet")}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "fixed inset-x-0 bottom-0 z-50 flex max-h-[calc(100svh-var(--safe-top)-1.5rem)] flex-col rounded-t-panel border-t border-line bg-surface-solid text-ink shadow-float outline-none",
                  "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[min(44rem,calc(100svh-4rem))] md:w-[min(34rem,calc(100vw-4rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-panel md:border",
                )}
                exit={{ opacity: 0, y: 48, transition: timing("sheetExit", "depart") }}
                initial={{ opacity: 0, y: 48 }}
                transition={timing("sheet", "nav")}
              >
                <header className="flex items-start gap-3 px-6 pb-2 pt-5">
                  <div className="min-w-0 flex-1 pt-1.5">
                    <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
                    {description ? (
                      <Dialog.Description className="mt-1 text-sm text-ink-muted">{description}</Dialog.Description>
                    ) : null}
                  </div>
                  <Dialog.Close asChild>
                    <Button aria-label={closeLabel} size="icon-sm" variant="secondary"><X weight="bold" /></Button>
                  </Dialog.Close>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2">{children}</div>
                {footer ? (
                  <footer className="flex justify-end gap-2 border-t border-line px-6 pb-[max(1rem,var(--safe-bottom))] pt-4">{footer}</footer>
                ) : null}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
