"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "./button";
import { ModalRoot, ModalTrigger, useModal } from "./modal-context";
import { ModalSurface, type ModalSurfaceProps } from "./modal-surface";
import { HeaderBackdrop } from "./header-backdrop";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

export const Dialog = ModalRoot;
export const DialogTrigger = ModalTrigger;
export function DialogClose({
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const state = useModal();
  return (
    <Button
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) state.requestClose();
      }}
    />
  );
}
export function DialogContent({
  children,
  showCloseButton = true,
  ...props
}: ModalSurfaceProps & { showCloseButton?: boolean }) {
  const { t } = useI18n();
  return (
    <ModalSurface
      {...props}
      data-slot="dialog-content"
      dismissible={showCloseButton}
    >
      {children}
      {showCloseButton ? (
        <DialogClose
          data-slot="dialog-close"
          className="absolute right-3 top-3"
          size="icon"
          variant="ghost"
          aria-label={t("common.close")}
        >
          <X />
        </DialogClose>
      ) : null}
    </ModalSurface>
  );
}
export function DialogHeader({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      data-slot="dialog-header"
      className={cn("relative text-left", className)}
    >
      <HeaderBackdrop />
      <div className="relative grid min-h-9 gap-2 pr-10">{children}</div>
    </div>
  );
}
export function DialogFooter({
  className,
  showCloseButton,
  children,
  ...props
}: React.ComponentProps<"div"> & { showCloseButton?: boolean }) {
  const { t } = useI18n();
  return (
    <div
      {...props}
      data-slot="dialog-footer"
      className={cn("flex flex-wrap justify-end gap-2", className)}
    >
      {children}
      {showCloseButton ? (
        <DialogClose variant="outline">{t("common.close")}</DialogClose>
      ) : null}
    </div>
  );
}
export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  const state = useModal();
  return (
    <h2
      {...props}
      id={state.titleId}
      data-slot="dialog-title"
      className={cn("dialog-title text-lg font-semibold", className)}
    />
  );
}
export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  const state = useModal();
  return (
    <p
      {...props}
      id={state.descriptionId}
      data-slot="dialog-description"
      className={cn("dialog-text text-sm text-muted-foreground", className)}
    />
  );
}
