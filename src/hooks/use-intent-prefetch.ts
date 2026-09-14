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

/**
 * Start the navigation before the tap finishes.
 *
 * A pointer resting on a destination, or pressed on one, has already said
 * where it is going: a mouse dwells on a card for a moment before the click,
 * and a finger is down for something like a tenth of a second before the
 * browser is willing to call it a tap. Both are long enough to fetch the
 * route's code and the record it will show, so what the click has left to do
 * is render something already in memory.
 *
 * The cost is requests for destinations that are never opened. That is the
 * trade this app wants: a warmed route that goes unused costs one cached read,
 * while a cold one costs the user a wait every time.
 */
export function useIntentPrefetch() {
  const router = useRouter();
  const session = useSession();
  const scope = session.user?.uid;

  React.useEffect(() => {
    // A destination is warmed once per session: everything it warms is cached
    // behind it, so asking again would only repeat work that has been done.
    const warmed = new Set<string>();

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

    // Hover is the mouse's intent; a press is everyone else's. Touch reports a
    // hover of its own on the way to a tap, which would warm nothing sooner
    // than the press already does.
    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === "mouse") warm(event.target);
    };
    const onPointerDown = (event: PointerEvent) => warm(event.target);
    // Moving the focus ring onto a link is the keyboard saying the same thing.
    const onFocusIn = (event: FocusEvent) => warm(event.target);

    document.addEventListener("pointerover", onPointerOver, { capture: true, passive: true });
    document.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
    document.addEventListener("focusin", onFocusIn, { capture: true, passive: true });
    return () => {
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
    };
  }, [router, scope]);
}
