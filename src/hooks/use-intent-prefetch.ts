"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  interactiveTarget,
  internalAnchor,
  internalHref,
  isDisabledTarget,
} from "@/lib/interactive-target";

// A pointer crossing a list on its way somewhere else passes over every card in
// it. Waiting this long before believing a hover filters those out; it is short
// enough that a pointer which stopped to read has already paid it.
const HOVER_INTENT_MS = 80;

/**
 * Fetch the page before the tap finishes.
 *
 * A pointer resting on a destination, or pressed on one, has already said where
 * it is going: a mouse dwells on a card before the click, the focus ring lands
 * on a link before Enter, and a finger is down for something like a tenth of a
 * second before the browser is willing to call it a tap. Each of those warms
 * the route, so the click has only to render a page the browser already holds.
 *
 * The page is all that is warmed. What the page then shows it asks the backend
 * for itself, once it is on screen and its skeleton is standing in for the
 * answer — a record fetched ahead of a navigation that never happens is a
 * request nobody needed.
 */
export function useIntentPrefetch() {
  const router = useRouter();

  React.useEffect(() => {
    // A destination is warmed once: the router holds what it fetched, so asking
    // again would only repeat work that has already been done.
    const warmed = new Set<string>();
    let dwell = 0;

    const warm = (eventTarget: EventTarget | null) => {
      const target = interactiveTarget(eventTarget);
      if (!target || isDisabledTarget(target)) return;
      const anchor = internalAnchor(target);
      if (!anchor) return;
      const href = internalHref(anchor);
      if (warmed.has(href)) return;
      warmed.add(href);
      router.prefetch(href);
    };

    // Hover is the mouse's intent, and only once it has stayed put. A press and
    // a focus are unambiguous, so they are answered at once — and a press ends
    // any hover the same pointer was still being given the benefit of the doubt
    // over. Touch reports a hover of its own on the way to a tap, which would
    // warm nothing sooner than the press already does.
    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const target = event.target;
      window.clearTimeout(dwell);
      dwell = window.setTimeout(() => warm(target), HOVER_INTENT_MS);
    };
    const onPointerDown = (event: PointerEvent) => {
      window.clearTimeout(dwell);
      warm(event.target);
    };
    const onFocusIn = (event: FocusEvent) => warm(event.target);

    document.addEventListener("pointerover", onPointerOver, { capture: true, passive: true });
    document.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
    document.addEventListener("focusin", onFocusIn, { capture: true, passive: true });
    return () => {
      window.clearTimeout(dwell);
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
    };
  }, [router]);
}
