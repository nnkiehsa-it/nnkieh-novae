"use client";

import * as React from "react";
import { Icon, Navbar } from "framework7-react";
import { ModalContext, ModalRoot, useModal } from "./modal-context";
import { ModalSurface, type ModalSurfaceProps } from "./modal-surface";
import { DialogHeader } from "./dialog";
import { ToolbarButton } from "./toolbar-button";
import { useNativeNavbarSize } from "./use-native-navbar";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

export const Sheet = ModalRoot;
export function SheetTitle({className, style, ...props}: React.ComponentProps<"h2">) {
  const state = useModal();
  return <h2 {...props} id={state.titleId} className={className} style={{ font: "inherit", margin: 0, ...style }} />;
}
export function SheetDescription({className, ...props}: React.ComponentProps<"div">) {
  const state = useModal();
  return <div {...props} id={state.descriptionId} className={cn("subtitle", className)} />;
}
export function useSheetClose() {
  return React.useContext(ModalContext)?.requestClose ?? null;
}
export function SheetCloseButton({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof ToolbarButton>) {
  const { t } = useI18n();
  const close = useSheetClose();
  if (!close) return null;
  return (
    <ToolbarButton
      {...props}
      aria-label={t("common.close")}
      className={className}
      data-slot="dialog-close"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) close();
      }}
    >
      <Icon f7="xmark" aria-hidden="true" />
    </ToolbarButton>
  );
}
export function SheetHeader({
  children,
  ...props
}: React.ComponentProps<typeof DialogHeader>) {
  const navbarRef = React.useRef<{ el: HTMLElement | null }>({ el: null });
  useNativeNavbarSize(navbarRef);
  return (
    <div {...props} data-slot="dialog-header" data-sheet-drag-region="">
      <Navbar ref={navbarRef}>
        <div slot="title">{children}</div>
        <div slot="right">
          <SheetCloseButton />
        </div>
      </Navbar>
    </div>
  );
}
export function SheetContent({
  className,
  kind = "popup",
  ...props
}: Omit<ModalSurfaceProps, "kind"> & { kind?: "popup" | "sheet" }) {
  return (
    <ModalSurface
      {...props}
      kind={kind}
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
