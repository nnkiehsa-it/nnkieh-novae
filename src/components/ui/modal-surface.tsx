"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { f7, f7ready } from "framework7-react";
import type { Dialog, Sheet, Popover } from "framework7/types";
import { useModal } from "./modal-context";
import { cn } from "@/lib/utils";
import { beginSheetClose, holdStageBehind, publishStageFocusRestore } from "@/lib/stage-depth";

type ModalInstance = Dialog.Dialog | Sheet.Sheet | Popover.Popover;
const modalStack: HTMLElement[] = [];
const focusSelector = 'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]';
export type ModalSurfaceProps = React.ComponentProps<"div"> & {
  kind?: "dialog" | "sheet" | "popover";
  dismissible?: boolean;
  stageScrollY?: number;
  suppressEntrance?: boolean;
  surface?: "floating" | "plain";
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
};

/** Framework7 owns presentation and departure; feature state changes after closed. */
export function ModalSurface({ kind = "dialog", dismissible = true, className, children, stageScrollY,
  suppressEntrance = false, surface: _surface, onOpenAutoFocus, onCloseAutoFocus, ...props }: ModalSurfaceProps) {
  const state = useModal();
  const element = React.useRef<HTMLDivElement>(null);
  const instance = React.useRef<ModalInstance | null>(null);
  const latest = React.useRef({ state, onOpenAutoFocus, onCloseAutoFocus });
  const returnFocus = React.useRef<HTMLElement | null>(null);
  const releaseStage = React.useRef<(() => void) | null>(null);
  const ready = React.useSyncExternalStore(() => () => {}, () => true, () => false);
  React.useLayoutEffect(() => { latest.current = { state, onOpenAutoFocus, onCloseAutoFocus }; });

  React.useEffect(() => {
    if (!ready) return;
    let disposed = false;
    const node = element.current;
    f7ready(() => {
      if (disposed || !node) return;
      const onOpen = () => {
        returnFocus.current = document.activeElement as HTMLElement;
        modalStack.push(node);
        node.dataset.state = "open";
        if (kind === "sheet") releaseStage.current = holdStageBehind(node, stageScrollY);
        const event = new Event("openAutoFocus", { cancelable: true });
        latest.current.onOpenAutoFocus?.(event);
        if (!event.defaultPrevented) {
          requestAnimationFrame(() => {
            if (modalStack.at(-1) !== node) return;
            (node.querySelector<HTMLElement>("[autofocus]") ?? node).focus({ preventScroll: true });
          });
        }
      };
      const onClosed = () => {
        const index = modalStack.indexOf(node);
        if (index >= 0) modalStack.splice(index, 1);
        node.dataset.state = "closed";
        releaseStage.current?.();
        releaseStage.current = null;
        const event = new Event("closeAutoFocus", { cancelable: true });
        latest.current.onCloseAutoFocus?.(event);
        if (!event.defaultPrevented && returnFocus.current?.isConnected && document.documentElement.dataset.inputModality === "keyboard") {
          returnFocus.current.focus({ preventScroll: true });
        }
        latest.current.state.closed();
        requestAnimationFrame(publishStageFocusRestore);
      };
      const params = { el: node, containerEl: document.body, backdrop: true, backdropUnique: true,
        closeByBackdropClick: false, closeByOutsideClick: false, closeOnEscape: false,
        animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !suppressEntrance,
        on: { open: onOpen, close: () => { if (kind === "sheet") beginSheetClose(node); }, closed: onClosed } };
      instance.current = kind === "sheet" ? f7.sheet.create(params) : kind === "popover"
        ? f7.popover.create({ ...params, targetEl: latest.current.state.target.current ?? undefined })
        : f7.dialog.create(params);
      if (latest.current.state.open) instance.current.open();
    });
    return () => {
      disposed = true;
      if (node) {
        const index = modalStack.indexOf(node);
        if (index >= 0) modalStack.splice(index, 1);
      }
      releaseStage.current?.();
      releaseStage.current = null;
      instance.current?.close(false);
      instance.current?.destroy();
      instance.current = null;
    };
  }, [kind, ready, stageScrollY, suppressEntrance]);

  React.useEffect(() => {
    const modal = instance.current;
    if (!modal) return;
    if (state.open && !modal.opened) {
      if (kind === "popover") (modal as Popover.Popover).open(state.target.current!);
      else modal.open();
    }
    else if (!state.open && modal.opened) modal.close();
  }, [kind, state.open, state.target]);

  React.useEffect(() => {
    if (!state.open) return;
    const onKey = (event: KeyboardEvent) => {
      const node = element.current;
      if (!node || modalStack.at(-1) !== node) return;
      if (event.key === "Escape" && dismissible) { event.preventDefault(); event.stopPropagation(); latest.current.state.requestClose(); }
      if (event.key !== "Tab") return;
      const targets = [...node.querySelectorAll<HTMLElement>(focusSelector)].filter((target) => target.getClientRects().length);
      const first = targets[0], last = targets.at(-1);
      if (!first) { event.preventDefault(); node.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === node)) { event.preventDefault(); first.focus(); }
    };
    const onOutside = (event: MouseEvent) => {
      const node = element.current;
      if (dismissible && node && modalStack.at(-1) === node && event.target instanceof Element
        && event.target.matches(".dialog-backdrop,.sheet-backdrop,.popover-backdrop")) latest.current.state.requestClose();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("click", onOutside);
    return () => { document.removeEventListener("keydown", onKey, true); document.removeEventListener("click", onOutside); };
  }, [dismissible, state.open]);

  if (!ready) return null;
  const classes = { sheet: "sheet-modal sheet-modal-bottom novae-sheet", dialog: "dialog novae-dialog", popover: "popover novae-popover" };
  return createPortal(
    <div {...props} ref={element} className={cn(classes[kind], "novae-modal", className)}
      role={dismissible ? "dialog" : "alertdialog"} aria-modal="true" aria-labelledby={state.titleId}
      aria-describedby={state.descriptionId} tabIndex={-1} data-state="closed">
      <div className={kind === "sheet" ? "sheet-modal-inner" : kind === "popover" ? "popover-inner" : "dialog-inner"}>{children}</div>
    </div>, document.body,
  );
}
