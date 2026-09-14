"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  interactiveTarget,
  internalAnchor,
  internalHref,
  isDisabledTarget,
} from "@/lib/interactive-target";
import { preloadContentRoute } from "@/services/content-preload";
import { useSession } from "@/hooks/use-session";

// A pointer crossing a list on its way somewhere else passes over every card in
// it. Waiting this long before believing a hover filters those out; it is short
// enough that a pointer which stopped to read has already paid it.
const HOVER_INTENT_MS = 80;

/**
 * Start the navigation before the tap finishes.
 *
 * A pointer resting on a destination, or pressed on one, has already said where
 * it is going: a mouse dwells on a card before the click, the focus ring lands
 * on a link before Enter, and a finger is down for something like a tenth of a
 * second before the browser is willing to call it a tap. Each of those warms
 * the route's code and, for a detail route, the record it will show, so the
 * click has only to render something already in memory.
 *
 * The cost is requests for destinations that are never opened. That is the
 * trade this app wants: a warmed route that goes unused costs one cached read,
 * while a cold one costs the user a wait every single time.
 */
export function useIntentPrefetch() {
  const router = useRouter();
  const session = useSession();
  const scope = session.user?.uid;

  React.useEffect(() => {
    // A destination is warmed once: everything behind it is cached, so asking
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
      void preloadContentRoute(new URL(anchor.href, window.location.href).pathname, scope);
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
  }, [router, scope]);
}
