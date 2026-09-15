"use client";

import * as React from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

export const sheetCloseButtonClass = "size-11 shrink-0 md:size-9";

/**
 * The one sheet surface used throughout the product.
 *
 * Dialog still owns the Radix mechanics and centred-dialog presentation. A
 * sheet adds the mobile full-height contract and the shared close control, so a
 * feature cannot quietly grow a second generation of sheet chrome around the
 * same primitive.
 */
const Sheet = Dialog;
const SheetClose = DialogClose;
const SheetDescription = DialogDescription;
const SheetFooter = DialogFooter;
const SheetHeader = DialogHeader;
const SheetTitle = DialogTitle;
const SheetTrigger = DialogTrigger;

type SheetContentProps = Omit<
  React.ComponentProps<typeof DialogContent>,
  "presentation"
>;

function SheetContent({
  children,
  className,
  showCloseButton = true,
  ...props
}: SheetContentProps) {
  const { t } = useI18n();

  return (
    <DialogContent
      className={cn(
        "gap-2",
        className,
      )}
      presentation="sheet"
      showCloseButton={false}
      {...props}
    >
      {children}
      {showCloseButton ? (
        <SheetClose asChild>
          <Button
            aria-label={t("common.close")}
            className={cn(
              "absolute right-(--dialog-pad) top-(--dialog-pad) z-30",
              sheetCloseButtonClass,
            )}
            size="icon"
            variant="ghost"
          >
            <X />
            <span className="sr-only">{t("common.close")}</span>
          </Button>
        </SheetClose>
      ) : null}
    </DialogContent>
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
