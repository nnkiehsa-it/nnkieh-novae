"use client";

import { ModalRoot, ModalTrigger } from "./modal-context";
import { ModalSurface, type ModalSurfaceProps } from "./modal-surface";
import { cn } from "@/lib/utils";

export const Popover = ModalRoot;
export const PopoverTrigger = ModalTrigger;
export function PopoverContent({ className, align: _align, sideOffset: _offset, ...props }: ModalSurfaceProps & {
  align?: "start" | "center" | "end"; sideOffset?: number;
}) {
  return <ModalSurface {...props} kind="popover" data-slot="popover-content" className={cn("w-72", className)} />;
}
