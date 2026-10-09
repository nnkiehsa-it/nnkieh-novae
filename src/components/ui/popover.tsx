"use client";

import { ModalRoot, ModalTrigger } from "./modal-context";
import { ModalSurface, type ModalSurfaceProps } from "./modal-surface";
import { cn } from "@/lib/utils";
import { useCompactViewport } from "./use-compact-viewport";
import { SheetHeader, SheetTitle } from "./sheet";

export const Popover = ModalRoot;
export const PopoverTrigger = ModalTrigger;
export function PopoverContent({
  className,
  children,
  title,
  align: _align,
  sideOffset: _offset,
  ...props
}: ModalSurfaceProps & {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}) {
  const compact = useCompactViewport();
  return (
    <ModalSurface
      {...props}
      kind={compact ? "sheet" : "popover"}
      data-slot="popover-content"
      className={cn(!compact && "w-72", className)}
    >
      {compact && title ? (
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
      ) : null}
      {children}
    </ModalSurface>
  );
}
