"use client";

import { useEffect } from "react";
import { f7ready } from "framework7-react";
import { bindNativeModalCleanup } from "./native-modal-lifecycle";
import {
  beginSheetClose,
  holdStageBehind,
  publishStageFocusRestore,
} from "@/lib/stage-depth";

type Modal = { el: HTMLElement; type?: string } & Parameters<typeof bindNativeModalCleanup>[0];
const layers: HTMLElement[] = [];
export function topNativeModal() {
  return layers.at(-1);
}

/** Include Smart Select and Photo Browser in the same document-scroll lifecycle. */
export function NativeModalLayers() {
  useEffect(() => {
    const releases = new Map<HTMLElement, () => void>();
    const returnFocus = new Map<HTMLElement, HTMLElement>();
    let detach = () => {};
    f7ready((app) => {
      const open = (modal: Modal) => {
        const {el, type} = modal;
        if (type === "toast" || type === "tooltip") return;
        if (!el.classList.contains("novae-modal"))
          bindNativeModalCleanup(modal, type === "popup");
        // SDK-generated Smart Select and Photo Browser modals need DOM semantics.
        if (!el.hasAttribute("role")) {
          el.setAttribute("role", "dialog");
          el.setAttribute("aria-modal", "true");
          el.tabIndex = -1;
          returnFocus.set(el, document.activeElement as HTMLElement);
          el.querySelectorAll("i.icon").forEach((icon) => icon.setAttribute("aria-hidden", "true"));
          el.querySelectorAll<HTMLAnchorElement>("a:not([href])").forEach((link) => {
            link.href = "#";
            link.setAttribute("role", "button");
          });
        }
        layers.push(el);
        if (type === "sheet" || type === "popup")
          releases.set(
            el,
            holdStageBehind(
              el,
              el.dataset.stageScrollY === undefined
                ? undefined
                : Number(el.dataset.stageScrollY),
            ),
          );
      };
      const close = ({ el }: Modal) => {
        beginSheetClose(el);
      };
      const opened = ({ el }: Modal) => {
        if (returnFocus.has(el) && topNativeModal() === el)
          el.focus({ preventScroll: true });
      };
      const closed = ({ el }: Modal) => {
        const index = layers.indexOf(el);
        if (index >= 0) layers.splice(index, 1);
        releases.get(el)?.();
        releases.delete(el);
        if (document.documentElement.dataset.inputModality === "keyboard")
          returnFocus.get(el)?.focus({ preventScroll: true });
        returnFocus.delete(el);
        requestAnimationFrame(publishStageFocusRestore);
      };
      const onKey = (event: KeyboardEvent) => {
        const el = topNativeModal();
        if (!el || event.key !== "Tab") return;
        const targets = [
          ...el.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
          ),
        ].filter((target) => target.getClientRects().length);
        const first = targets[0],
          last = targets.at(-1);
        if (!first) {
          event.preventDefault();
          el.tabIndex = -1;
          el.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === el)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || document.activeElement === el)
        ) {
          event.preventDefault();
          first.focus();
        }
      };
      const kinds = ["popup", "sheet", "popover", "actions", "dialog"] as const;
      kinds.forEach((kind) => {
        app.on(`${kind}Open`, open);
        app.on(`${kind}Opened`, opened);
        app.on(`${kind}Close`, close);
        app.on(`${kind}Closed`, closed);
      });
      document.addEventListener("keydown", onKey, true);
      detach = () => {
        kinds.forEach((kind) => {
          app.off(`${kind}Open`, open);
          app.off(`${kind}Opened`, opened);
          app.off(`${kind}Close`, close);
          app.off(`${kind}Closed`, closed);
        });
        document.removeEventListener("keydown", onKey, true);
        releases.forEach((release) => release());
        layers.length = 0;
      };
    });
    return () => detach();
  }, []);
  return null;
}
