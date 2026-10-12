"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * A centred question or explanation that asks for attention, such as an
 * install guide or a permission request. `dismissible={false}` keeps the scrim
 * and Escape from closing it, for prompts that must be answered.
 */
export function Dialog({
  actions,
  children,
  className,
  description,
  dismissible = true,
  icon,
  onOpenChange,
  open,
  title,
}: {
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  dismissible?: boolean;
  icon?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
  open: boolean;
  title: React.ReactNode;
}) {
  const block = (event: Event) => { if (!dismissible) event.preventDefault(); };
  return (
    <DialogPrimitive.Root onOpenChange={onOpenChange} open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--scrim)]" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 grid max-h-[calc(100svh-2rem)] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto rounded-panel border border-line bg-surface-solid p-6 text-ink shadow-float outline-none",
            className,
          )}
          onEscapeKeyDown={block}
          onInteractOutside={block}
        >
          <div className="grid gap-2">
            {icon ? (
              <span aria-hidden className="mb-2 grid size-12 place-items-center rounded-full bg-surface-raised text-ink [&_svg]:size-6">{icon}</span>
            ) : null}
            <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-[0.9375rem] leading-relaxed text-ink-muted">{description}</DialogPrimitive.Description>
            ) : null}
          </div>
          {children}
          {actions ? <div className="flex flex-wrap justify-end gap-2">{actions}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
