"use client";

import * as React from "react";
import { X } from "lucide-react";
import { ModalContext, ModalRoot } from "./modal-context";
import { ModalSurface, type ModalSurfaceProps } from "./modal-surface";
import { DialogDescription, DialogHeader, DialogTitle } from "./dialog";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

export const Sheet = ModalRoot;
export const SheetDescription = DialogDescription;
export const SheetTitle = DialogTitle;
export const sheetCloseButtonClass = "size-11 shrink-0 md:size-9";
export function useSheetClose() {
  return React.useContext(ModalContext)?.requestClose ?? null;
}
export function SheetCloseButton({
  className,
  onClick,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "type" | "variant">) {
  const { t } = useI18n();
  const close = useSheetClose();
  if (!close) return null;
  return (
    <Button
      {...props}
      aria-label={t("common.close")}
      className={cn(sheetCloseButtonClass, className)}
      data-slot="dialog-close"
      size="icon"
      type="button"
      variant="ghost"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) close();
      }}
    >
      <X />
    </Button>
  );
}
export function SheetHeader({
  children,
  ...props
}: React.ComponentProps<typeof DialogHeader>) {
  return (
    <DialogHeader {...props} data-sheet-drag-region="">
      {children}
      <SheetCloseButton className="absolute right-0 top-0 z-30" />
    </DialogHeader>
  );
}
export function SheetContent({
  className,
  ...props
}: Omit<ModalSurfaceProps, "kind">) {
  return (
    <ModalSurface
      {...props}
      kind="sheet"
      className={cn("min-h-0 overflow-hidden", className)}
      data-slot="dialog-content"
      data-sheet-surface=""
    />
  );
}
export function SheetBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      data-slot="sheet-body"
      className={cn(
        "sheet-body min-h-0 overflow-x-clip overflow-y-auto",
        className,
      )}
    />
  );
}
