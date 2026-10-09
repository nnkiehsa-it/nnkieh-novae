"use client";

import * as React from "react";
import { Button } from "./button";
import { ModalRoot, ModalTrigger, useModal } from "./modal-context";
import { ModalSurface, type ModalSurfaceProps } from "./modal-surface";
import { cn } from "@/lib/utils";

export const AlertDialog = ModalRoot;
export const AlertDialogTrigger = ModalTrigger;
export function AlertDialogContent({
  className,
  size = "default",
  children,
  ...props
}: ModalSurfaceProps & { size?: "default" | "sm" }) {
  return (
    <ModalSurface
      {...props}
      dismissible={false}
      data-slot="alert-dialog-content"
      data-size={size}
      className={cn(size === "sm" && "max-w-xs", className)}
    >
      <div className="dialog-inner">
        {React.Children.map(children, (child) =>
          React.isValidElement(child) && child.type === AlertDialogFooter
            ? null
            : child,
        )}
      </div>
      {React.Children.map(children, (child) =>
        React.isValidElement(child) && child.type === AlertDialogFooter
          ? child
          : null,
      )}
    </ModalSurface>
  );
}
export function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div {...props} data-slot="alert-dialog-header" className={className} />
  );
}
export function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      data-slot="alert-dialog-footer"
      className={cn("dialog-buttons", className)}
    />
  );
}
export function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  const state = useModal();
  return (
    <h2
      {...props}
      id={state.titleId}
      data-slot="alert-dialog-title"
      className={cn("dialog-title", className)}
    />
  );
}
export function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  const state = useModal();
  return (
    <p
      {...props}
      id={state.descriptionId}
      data-slot="alert-dialog-description"
      className={cn("dialog-text", className)}
    />
  );
}
export function AlertDialogMedia({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      data-slot="alert-dialog-media"
      className={cn(
        "mb-2 flex size-16 items-center justify-center rounded-xl bg-muted",
        className,
      )}
    />
  );
}
export function AlertDialogAction({
  onClick,
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const state = useModal();
  return (
    <Button
      {...props}
      size="lg"
      className={cn("button-round dialog-button", className)}
      data-slot="alert-dialog-action"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) state.requestClose();
      }}
    />
  );
}
export function AlertDialogCancel(props: React.ComponentProps<typeof Button>) {
  return (
    <AlertDialogAction
      variant="secondary"
      {...props}
      data-slot="alert-dialog-cancel"
    />
  );
}
