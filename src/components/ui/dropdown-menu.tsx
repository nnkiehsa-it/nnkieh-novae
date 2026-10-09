"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Slot } from "./slot";
import { useModal } from "./modal-context";
import { cn } from "@/lib/utils";

export const DropdownMenu = Popover;
export const DropdownMenuTrigger = PopoverTrigger;
export function DropdownMenuContent({
  onKeyDown,
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  return (
    <PopoverContent
      {...props}
      role="menu"
      data-slot="dropdown-menu-content"
      onKeyDown={(event) => {
        onKeyDown?.(event);
        const entries = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            '[role="menuitem"]',
          ),
        ];
        const current = entries.indexOf(document.activeElement as HTMLElement);
        const next =
          event.key === "ArrowDown"
            ? (current + 1) % entries.length
            : event.key === "ArrowUp"
              ? (current + entries.length - 1) % entries.length
              : event.key === "Home"
                ? 0
                : event.key === "End"
                  ? entries.length - 1
                  : null;
        if (next === null || !entries.length) return;
        event.preventDefault();
        entries[next].focus();
      }}
    />
  );
}
export function DropdownMenuItem({
  asChild,
  onSelect,
  className,
  onClick,
  ...props
}: Omit<React.ComponentProps<"button">, "onSelect"> & {
  asChild?: boolean;
  onSelect?: (event: Event) => void;
}) {
  const state = useModal();
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      {...props}
      role="menuitem"
      data-slot="dropdown-menu-item"
      className={cn(
        "item-link flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-accent [&_svg]:size-4",
        className,
      )}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        const select = new Event("select", { cancelable: true });
        onSelect?.(select);
        if (!select.defaultPrevented) state.requestClose();
      }}
    />
  );
}
export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div {...props} className={cn("px-3 py-2 text-sm", className)} />;
}
export function DropdownMenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-border" />;
}
