"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "./button";
import { ModalRoot, ModalTrigger, useModal } from "./modal-context";
import { ModalSurface, type ModalSurfaceProps } from "./modal-surface";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { DialogButtonsContext } from "./dialog-buttons-context";

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
  footer,
  ...props
}: ModalSurfaceProps & { showCloseButton?: boolean; footer?: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <ModalSurface
      {...props}
      data-slot="dialog-content"
      dismissible={showCloseButton}
    >
      <div className="dialog-inner">
        {React.Children.map(children, (child) =>
          React.isValidElement(child) && child.type === DialogFooter
            ? null
            : child,
        )}
      </div>
      {React.Children.map(children, (child) =>
        React.isValidElement(child) && child.type === DialogFooter
          ? child
          : null,
      )}
      {footer}
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
    <div {...props} data-slot="dialog-header" className={className}>
      {children}
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
      className={cn("dialog-buttons", className)}
    >
      <DialogButtonsContext.Provider value>{children}
      {showCloseButton ? (
        <DialogClose variant="outline">{t("common.close")}</DialogClose>
      ) : null}
      </DialogButtonsContext.Provider>
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
      className={cn("dialog-title", className)}
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
      className={cn("dialog-text", className)}
    />
  );
}
