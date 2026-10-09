"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { f7, f7ready } from "framework7-react";
import type { Actions, Dialog, Sheet, Popup, Popover } from "framework7/types";
import { useModal } from "./modal-context";
import { cn } from "@/lib/utils";
import { topNativeModal } from "./native-modal-layers";
import { bindNativeModalCleanup } from "./native-modal-lifecycle";

type ModalInstance =
  Actions.Actions | Dialog.Dialog | Sheet.Sheet | Popup.Popup | Popover.Popover;
export type ModalSurfaceProps = React.ComponentProps<"div"> & {
  kind?: "actions" | "dialog" | "sheet" | "popup" | "popover";
  dismissible?: boolean;
  stageScrollY?: number;
  suppressEntrance?: boolean;
  surface?: "floating" | "plain";
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
};

/** Framework7 owns presentation and departure; feature state changes after closed. */
export function ModalSurface({
  kind = "dialog",
  dismissible = true,
  className,
  children,
  stageScrollY,
  suppressEntrance = false,
  surface: _surface,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: ModalSurfaceProps) {
  const state = useModal();
  const [present, setPresent] = React.useState(state.open);
  const element = React.useRef<HTMLDivElement>(null);
  const instance = React.useRef<ModalInstance | null>(null);
  const latest = React.useRef({ state, onOpenAutoFocus, onCloseAutoFocus });
  const returnFocus = React.useRef<HTMLElement | null>(null);
  const ready = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const holdsStage = kind === "sheet" || kind === "popup";
  React.useLayoutEffect(() => {
    latest.current = { state, onOpenAutoFocus, onCloseAutoFocus };
  });
  React.useEffect(() => {
    if (state.open) setPresent(true);
  }, [state.open]);

  React.useEffect(() => {
    if (!ready || !present) return;
    let disposed = false;
    const node = element.current;
    f7ready(() => {
      if (disposed || !node) return;
      const onOpen = () => {
        returnFocus.current = document.activeElement as HTMLElement;
        node.dataset.state = "open";
        if (
          !node.querySelector(
            `[id="${CSS.escape(latest.current.state.titleId)}"]`,
          )
        )
          node.removeAttribute("aria-labelledby");
        if (
          !node.querySelector(
            `[id="${CSS.escape(latest.current.state.descriptionId)}"]`,
          )
        )
          node.removeAttribute("aria-describedby");
        const event = new Event("openAutoFocus", { cancelable: true });
        latest.current.onOpenAutoFocus?.(event);
        if (!event.defaultPrevented) {
          requestAnimationFrame(() => {
            if (topNativeModal() !== node) return;
            (node.querySelector<HTMLElement>("[autofocus]") ?? node).focus({
              preventScroll: true,
            });
          });
        }
      };
      const onClosed = () => {
        node.dataset.state = "closed";
        const event = new Event("closeAutoFocus", { cancelable: true });
        latest.current.onCloseAutoFocus?.(event);
        if (
          !event.defaultPrevented &&
          returnFocus.current?.isConnected &&
          document.documentElement.dataset.inputModality === "keyboard"
        ) {
          returnFocus.current.focus({ preventScroll: true });
        }
        if (!disposed) {
          setPresent(false);
          latest.current.state.closed();
        }
      };
      const params = {
        el: node,
        containerEl: document.body,
        backdrop: true,
        backdropUnique: true,
        closeByBackdropClick: false,
        closeByOutsideClick: false,
        closeOnEscape: false,
        animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        on: {
          open: onOpen,
          close: () => {
            node.dataset.state = "closing";
          },
          closed: onClosed,
        },
      };
      instance.current =
        kind === "actions"
          ? f7.actions.create({ ...params, convertToPopover: false })
          : kind === "sheet"
            ? f7.sheet.create({ ...params, push: true, swipeToClose: dismissible, swipeHandler: ".navbar" })
            : kind === "popup"
              // The pinned 9.2 runtime supports direction strings; its types only list boolean.
              ? f7.popup.create({ ...params, push: true, swipeToClose: dismissible ? "to-bottom" : false, swipeHandler: ".navbar" } as unknown as Popup.Parameters)
              : kind === "popover"
                ? f7.popover.create({
                    ...params,
                    targetEl: latest.current.state.target.current ?? undefined,
                  })
                : f7.dialog.create(params);
      bindNativeModalCleanup(instance.current, kind === "popup");
      // Native swipe dismissal must pass the same draft/share guard as Close.
      if (holdsStage) {
        const native = instance.current;
        const close = native.close.bind(native);
        native.close = (animate?: boolean) => {
          if (!disposed && latest.current.state.open) latest.current.state.requestClose();
          else close(animate);
          return native;
        };
      }
      if (latest.current.state.open)
        instance.current.open(suppressEntrance ? false : undefined);
    });
    return () => {
      disposed = true;
      instance.current?.close(false);
      instance.current?.destroy();
      instance.current = null;
    };
  }, [dismissible, holdsStage, kind, present, ready, stageScrollY, suppressEntrance]);

  React.useEffect(() => {
    const modal = instance.current;
    if (!modal) return;
    if (state.open && !modal.opened) {
      if (kind === "popover")
        (modal as Popover.Popover).open(state.target.current!);
      else modal.open();
    } else if (!state.open && modal.opened) modal.close();
  }, [kind, state.open, state.target]);

  React.useEffect(() => {
    if (!state.open) return;
    const onKey = (event: KeyboardEvent) => {
      const node = element.current;
      if (!node || topNativeModal() !== node) return;
      if (event.key === "Escape" && dismissible) {
        event.preventDefault();
        event.stopPropagation();
        latest.current.state.requestClose();
      }
    };
    const onOutside = (event: MouseEvent) => {
      const node = element.current;
      if (
        dismissible &&
        node &&
        topNativeModal() === node &&
        event.target instanceof Element &&
        event.target.matches(
          ".actions-backdrop,.dialog-backdrop,.sheet-backdrop,.popup-backdrop,.popover-backdrop",
        )
      )
        latest.current.state.requestClose();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("click", onOutside);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("click", onOutside);
    };
  }, [dismissible, state.open]);

  if (!ready || !present) return null;
  const classes = {
    actions: "actions-modal",
    sheet: "sheet-modal sheet-modal-bottom novae-sheet",
    popup: "popup novae-sheet",
    dialog: "dialog novae-dialog",
    popover: "popover novae-popover",
  };
  return createPortal(
    <div
      {...props}
      ref={element}
      className={cn(classes[kind], "novae-modal", className)}
      role={dismissible ? "dialog" : "alertdialog"}
      aria-modal="true"
      aria-labelledby={state.titleId}
      aria-describedby={state.descriptionId}
      tabIndex={-1}
      data-state="closed"
      data-stage-scroll-y={stageScrollY}
    >
      {kind === "actions" || kind === "dialog" ? (
        children
      ) : (
        <div
          className={
            holdsStage
              ? kind === "sheet"
                ? "sheet-modal-inner novae-sheet-inner"
                : "novae-sheet-inner"
              : kind === "popover"
                ? "popover-inner"
                : "dialog-inner"
          }
        >
          {children}
        </div>
      )}
    </div>,
    document.body,
  );
}
