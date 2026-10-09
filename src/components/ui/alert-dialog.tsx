"use client";

import * as React from "react";
import { Button } from "./button";
import { ModalRoot, ModalTrigger, useModal } from "./modal-context";
import { ModalSurface, type ModalSurfaceProps } from "./modal-surface";
import { cn } from "@/lib/utils";

export const AlertDialog = ModalRoot;
export const AlertDialogTrigger = ModalTrigger;
export function AlertDialogContent({ className, size = "default", ...props }: ModalSurfaceProps & { size?: "default" | "sm" }) {
  return <ModalSurface {...props} dismissible={false} data-slot="alert-dialog-content" data-size={size} className={cn(size === "sm" && "max-w-xs", className)} />;
}
export function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div {...props} data-slot="alert-dialog-header" className={cn("grid gap-2", className)} />;
}
export function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div {...props} data-slot="alert-dialog-footer" className={cn("dialog-buttons flex flex-wrap justify-end gap-2", className)} />;
}
export function AlertDialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  const state = useModal();
  return <h2 {...props} id={state.titleId} data-slot="alert-dialog-title" className={cn("dialog-title text-lg font-semibold", className)} />;
}
export function AlertDialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  const state = useModal();
  return <p {...props} id={state.descriptionId} data-slot="alert-dialog-description" className={cn("dialog-text text-sm text-muted-foreground", className)} />;
}
export function AlertDialogMedia({ className, ...props }: React.ComponentProps<"div">) {
  return <div {...props} data-slot="alert-dialog-media" className={cn("mb-2 flex size-16 items-center justify-center rounded-xl bg-muted", className)} />;
}
export function AlertDialogAction({ onClick, ...props }: React.ComponentProps<typeof Button>) {
  const state = useModal();
  return <Button {...props} data-slot="alert-dialog-action" onClick={(event) => { onClick?.(event); if (!event.defaultPrevented) state.requestClose(); }} />;
}
export function AlertDialogCancel(props: React.ComponentProps<typeof Button>) {
  return <AlertDialogAction variant="outline" {...props} data-slot="alert-dialog-cancel" />;
}
