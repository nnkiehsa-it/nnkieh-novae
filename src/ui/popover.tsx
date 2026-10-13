"use client";

import * as React from "react";
import { Popover as PopoverPrimitive, Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/** A small panel anchored to its trigger, such as a search field behind a button. */
export function Popover({ children, className, onOpenChange, open, trigger }: {
  children: React.ReactNode;
  className?: string;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  trigger: React.ReactNode;
}) {
  return (
    <PopoverPrimitive.Root onOpenChange={onOpenChange} open={open}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          className={cn("float-surface z-50 w-[min(22rem,calc(100vw-2rem))] rounded-panel border border-line bg-surface-solid p-4 text-ink shadow-float outline-none", className)}
          collisionPadding={16}
          sideOffset={8}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export const TooltipProvider = TooltipPrimitive.Provider;

const HOVER_QUERY = "(hover: hover) and (pointer: fine)";

function subscribeToHover(onChange: () => void) {
  const query = window.matchMedia(HOVER_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Names an icon-only control on a pointer screen. A touch screen has no hover,
    so a tap would only leave the label stuck over the control; it is skipped. */
export function Tooltip({ children, label }: { children: React.ReactElement; label: string }) {
  const canHover = React.useSyncExternalStore(subscribeToHover, () => window.matchMedia(HOVER_QUERY).matches, () => false);
  if (!canHover) return children;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content className="float-surface z-50 rounded-full bg-contrast px-3 py-1.5 text-xs font-medium text-on-contrast" sideOffset={8}>
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
