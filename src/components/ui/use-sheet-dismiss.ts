"use client";

import { useEffect, type RefObject } from "react";

/** Route every dismissal through the draft/share guard before Framework7 closes. */
export function useSheetDismiss(
  element: RefObject<HTMLElement | null>,
  enabled: boolean,
  requestClose: () => void,
) {
  useEffect(() => {
    const node = element.current;
    if (!enabled || !node) return;
    let gesture: { pointerId: number; y: number; startedAt: number } | null =
      null;
    const reset = () => {
      gesture = null;
      node.style.removeProperty("translate");
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (
        !window.matchMedia("(max-width: 47.99rem)").matches ||
        !target.closest("[data-sheet-drag-region],.detail-header") ||
        target.closest("button,a,input,textarea,select,[role='button']")
      )
        return;
      gesture = {
        pointerId: event.pointerId,
        y: event.clientY,
        startedAt: performance.now(),
      };
      node.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (!gesture) return;
      node.style.translate = `0 ${Math.max(0, event.clientY - gesture.y)}px`;
    };
    const onUp = (event: PointerEvent) => {
      if (!gesture) return;
      const distance = Math.max(0, event.clientY - gesture.y);
      const velocity =
        distance / Math.max(1, performance.now() - gesture.startedAt);
      if (node.hasPointerCapture(gesture.pointerId))
        node.releasePointerCapture(gesture.pointerId);
      reset();
      if (
        distance >= Math.min(window.innerHeight * 0.22, 160) ||
        velocity >= 0.65
      )
        requestClose();
    };
    node.addEventListener("pointerdown", onDown);
    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerup", onUp);
    node.addEventListener("pointercancel", reset);
    return () => {
      reset();
      node.removeEventListener("pointerdown", onDown);
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerup", onUp);
      node.removeEventListener("pointercancel", reset);
    };
  }, [element, enabled, requestClose]);
}
