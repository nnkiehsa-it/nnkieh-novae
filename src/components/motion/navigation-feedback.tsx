"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { motionEasing, motionLoopSeconds } from "@/generated/motion-tokens";
import { timing, timingMs } from "@/lib/motion-timing";

// A navigation that never commits must not leave the page looking busy forever.
const PENDING_LIMIT_MS = 4_000;

interface NavigationEcho {
  borderRadius: string;
  height: number;
  id: number;
  left: number;
  top: number;
  width: number;
}

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
 */
export function NavigationFeedback() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [echo, setEcho] = React.useState<NavigationEcho | null>(null);
  const [pending, setPending] = React.useState(false);
  const sequence = React.useRef(0);
  const echoTimeout = React.useRef(0);
  const pendingTimeout = React.useRef(0);

  React.useEffect(() => {
    if (reduceMotion) return;

    const acknowledge = (event: Event) => {
      const target = interactiveTarget(event.target);
      if (!target || !internalAnchor(target)) return;
      if (
        target.matches(":disabled, [aria-disabled='true'], [data-disabled]") ||
        target.closest(":disabled, [aria-disabled='true'], [data-disabled]")
      ) {
        return;
      }
      const rect = target.getBoundingClientRect();
      sequence.current += 1;
      setEcho({
        borderRadius: getComputedStyle(target).borderRadius,
        height: rect.height,
        id: sequence.current,
        left: rect.left,
        top: rect.top,
        width: rect.width,
      });
      setPending(true);
      window.clearTimeout(echoTimeout.current);
      window.clearTimeout(pendingTimeout.current);
      pendingTimeout.current = window.setTimeout(() => {
        setPending(false);
        setEcho(null);
      }, PENDING_LIMIT_MS);
    };
    const onPointerDown = (event: PointerEvent) => acknowledge(event);
    // A keyboard activation reports no pointer detail, and has no pointerdown
    // of its own to have already acknowledged it.
    const onClick = (event: MouseEvent) => {
      if (event.detail === 0) acknowledge(event);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);
    return () => {
      window.clearTimeout(echoTimeout.current);
      window.clearTimeout(pendingTimeout.current);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [reduceMotion]);

  React.useEffect(() => {
    if (reduceMotion) return;

    window.clearTimeout(echoTimeout.current);
    window.clearTimeout(pendingTimeout.current);
    setPending(false);
    echoTimeout.current = window.setTimeout(
      () => setEcho(null),
      timingMs("sheet"),
    );
  }, [pathname, reduceMotion]);

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
      {echo ? (
        <motion.span
          key={echo.id}
          className="t-navigation-echo fixed"
          style={{
            borderRadius: echo.borderRadius,
            height: echo.height,
            left: echo.left,
            top: echo.top,
            width: echo.width,
          }}
          initial={{ opacity: 0.5, scale: 0.94 }}
          animate={{ opacity: pending ? 0.28 : 0, scale: pending ? 1.025 : 1.08 }}
          transition={timing("sheet")}
        />
      ) : null}
    </div>
  );
}
