"use client";

import { useEffect } from "react";
import { timingMs } from "@/lib/motion-timing";

interface ActiveResize {
  frame: number;
  target: number;
  timer: number;
}

// Height is the most expensive thing on the page to animate: every frame lays
// out the whole subtree underneath it. Three rules keep that affordable.
//
// Only containers that opt in with [data-resize-motion] are watched, and they
// are watched by a ResizeObserver alone — the observer already reports a
// container whose children changed, so nothing walks the document on every
// mutation. Sizes come from the observer's own measurement, so the handler
// never reads layout back and never forces a synchronous reflow.
//
// A container stays still while one of its ancestors is animating, because two
// nested heights moving at once is what reads as flicker rather than motion.
//
// And a jump larger than the tallest change the eye can follow is taken
// instantly: a container growing by a whole screen cannot be animated smoothly,
// and trying is what makes a large area crawl.
const MAX_ANIMATED_DELTA = 480;

export function ResizeMotion() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const heights = new Map<HTMLElement, number>();
    const active = new Map<HTMLElement, ActiveResize>();
    let viewportWidth = window.innerWidth;

    function restore(element: HTMLElement, state: ActiveResize) {
      window.cancelAnimationFrame(state.frame);
      window.clearTimeout(state.timer);
      element.style.height = "";
      element.style.transition = "";
      delete element.dataset.resizing;
      active.delete(element);
      heights.set(element, state.target);
    }

    function insideAnimation(element: HTMLElement) {
      for (let node = element.parentElement; node; node = node.parentElement) {
        if (active.has(node)) return true;
      }
      return false;
    }

    function resize(element: HTMLElement, next: number) {
      if (active.has(element)) return;
      const previous = heights.get(element);
      heights.set(element, next);
      if (reduced.matches || !previous) return;
      const delta = Math.abs(next - previous);
      if (delta <= 1 || delta > MAX_ANIMATED_DELTA || insideAnimation(element)) return;

      const state: ActiveResize = { frame: 0, target: next, timer: 0 };
      active.set(element, state);
      element.dataset.resizing = "true";
      element.style.transition = "none";
      element.style.height = `${previous}px`;
      state.frame = window.requestAnimationFrame(() => {
        if (active.get(element) !== state) return;
        element.style.transition = "";
        element.style.height = `${next}px`;
        state.timer = window.setTimeout(() => {
          if (active.get(element) === state) restore(element, state);
        }, timingMs("control") + 50);
      });
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const box = entry.borderBoxSize[0];
        resize(entry.target as HTMLElement, Math.round(box ? box.blockSize : entry.contentRect.height));
      }
    });

    function register(element: HTMLElement) {
      if (heights.has(element)) return;
      heights.set(element, 0);
      observer.observe(element);
    }
    function release(element: HTMLElement) {
      const state = active.get(element);
      if (state) restore(element, state);
      observer.unobserve(element);
      heights.delete(element);
    }
    function walk(node: Node, visit: (element: HTMLElement) => void) {
      if (!(node instanceof HTMLElement)) return;
      if (node.matches("[data-resize-motion]")) visit(node);
      node.querySelectorAll<HTMLElement>("[data-resize-motion]").forEach(visit);
    }

    walk(document.body, register);
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => walk(node, register));
        record.removedNodes.forEach((node) => walk(node, release));
      }
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    const stop = () => {
      for (const [element, state] of active) restore(element, state);
    };
    const settleViewport = () => {
      if (viewportWidth === window.innerWidth) return;
      viewportWidth = window.innerWidth;
      stop();
      for (const element of heights.keys()) heights.set(element, element.offsetHeight);
    };
    window.addEventListener("resize", settleViewport, { passive: true });
    reduced.addEventListener("change", stop);
    return () => {
      window.removeEventListener("resize", settleViewport);
      reduced.removeEventListener("change", stop);
      mutations.disconnect();
      observer.disconnect();
      stop();
    };
  }, []);
  return null;
}
