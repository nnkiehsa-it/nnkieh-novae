"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { motionEasing, motionLoopSeconds } from "@/generated/motion-tokens";
import { timing } from "@/lib/motion-timing";

// A navigation that never commits must not leave the page looking busy forever.
const PENDING_LIMIT_MS = 4_000;

function interactiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(
    "a[href], button, [role='button'], [role='menuitem'], [role='option'], [role='radio'], [role='checkbox'], [role='tab'], [role='switch'], [data-slot='select-trigger']",
  );
}

function internalAnchor(target: HTMLElement) {
  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
    return null;
  }
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  if (`${url.pathname}${url.search}${url.hash}` === `${location.pathname}${location.search}${location.hash}`) {
    return null;
  }
  return anchor;
}

/**
 * The answer to a tap whose result has not arrived yet.
 *
 * It is reserved for navigation. Every interactive surface already answers a
 * press through the press state in the stylesheet, and echoing an ordinary
 * button on top of that gave the same tap two acknowledgements. Only a
 * destination is worth an echo, because only a destination can take a second
 * to appear — which is also what the progress line is for.
 *
 * The echo is the destination's own control wearing a state, not a rectangle
 * drawn over the page where that control happened to be: a copy at page
 * coordinates is left behind the moment anything scrolls. It starts on the
 * click, so a touch that turns into a scroll never lights anything up — the
 * browser has already decided whether a gesture was a tap, and it does not
 * report one for a scroll.
 */
export function NavigationFeedback() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [pending, setPending] = React.useState(false);
  const marked = React.useRef<HTMLElement | null>(null);
  const pendingTimeout = React.useRef(0);

  const release = React.useCallback(() => {
    marked.current?.removeAttribute("data-navigating");
    marked.current = null;
    window.clearTimeout(pendingTimeout.current);
    setPending(false);
  }, []);

  React.useEffect(() => {
    if (reduceMotion) return;

    const onClick = (event: MouseEvent) => {
      // A modified click is the browser's to answer: it opens a tab this page
      // never navigates to.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = interactiveTarget(event.target);
      if (!target || target.closest("[data-primary-navigation]") || !internalAnchor(target)) return;
      if (
        target.matches(":disabled, [aria-disabled='true'], [data-disabled]") ||
        target.closest(":disabled, [aria-disabled='true'], [data-disabled]")
      ) {
        return;
      }
      release();
      target.setAttribute("data-navigating", "true");
      marked.current = target;
      setPending(true);
      pendingTimeout.current = window.setTimeout(release, PENDING_LIMIT_MS);
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      release();
    };
  }, [reduceMotion, release]);

  React.useEffect(() => {
    release();
  }, [pathname, release]);

  if (reduceMotion) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[70]">
      <AnimatePresence mode="wait">
        {pending ? (
          <motion.div
            className="t-navigation-progress fixed inset-x-0 top-0 h-0.5 origin-left"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 0.82 }}
            exit={{ opacity: 0, scaleX: 1, transition: timing("controlExit") }}
            transition={{
              opacity: timing("controlExit"),
              // The crawl is indeterminate: it paces a wait of unknown length
              // rather than moving a known distance, so it takes a loop rather
              // than a rung of the ladder.
              scaleX: { duration: motionLoopSeconds.sweep, ease: motionEasing.arrive },
            }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
