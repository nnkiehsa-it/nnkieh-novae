"use client";

import { useEffect } from "react";
import { f7ready } from "framework7-react";
import {
  beginSheetClose,
  holdStageBehind,
  publishStageFocusRestore,
} from "@/lib/stage-depth";

type Modal = { el: HTMLElement; type?: string };
const layers: HTMLElement[] = [];
export function topNativeModal() {
  return layers.at(-1);
}

/** Include Smart Select and Photo Browser in the same document-scroll lifecycle. */
export function NativeModalLayers() {
  useEffect(() => {
    const releases = new Map<HTMLElement, () => void>();
    let detach = () => {};
    f7ready((app) => {
      const open = ({ el, type }: Modal) => {
        if (type === "toast" || type === "tooltip") return;
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
      const closed = ({ el }: Modal) => {
        const index = layers.indexOf(el);
        if (index >= 0) layers.splice(index, 1);
        releases.get(el)?.();
        releases.delete(el);
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
        app.on(`${kind}Close`, close);
        app.on(`${kind}Closed`, closed);
      });
      document.addEventListener("keydown", onKey, true);
      detach = () => {
        kinds.forEach((kind) => {
          app.off(`${kind}Open`, open);
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
