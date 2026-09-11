"use client";

import { useEffect } from "react";
import { timingMs } from "@/lib/motion-timing";

interface Size {
  height: number;
}

interface ActiveResize {
  frame: number | null;
  timer: number | null;
  originalHeight: string;
  originalTransition: string;
}

// Only explicit state containers opt into height animation. Observing every
// card or route makes viewport reflow look like content motion and causes
// resize feedback on long pages.
export function ResizeMotion() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sizes = new Map<HTMLElement, Size>();
    const active = new Map<HTMLElement, ActiveResize>();
    const read = (element: HTMLElement) => ({ height: element.offsetHeight });
    const changed = (a: Size, b: Size) => Math.abs(a.height - b.height) > 1;
    let viewportWidth = window.innerWidth;

    function restore(element: HTMLElement, resize: ActiveResize) {
      if (resize.frame !== null) window.cancelAnimationFrame(resize.frame);
      if (resize.timer !== null) window.clearTimeout(resize.timer);
      element.style.height = resize.originalHeight;
      element.style.transition = resize.originalTransition;
      delete element.dataset.resizing;
      active.delete(element);
      sizes.set(element, read(element));
    }

    function resize(element: HTMLElement, next = read(element)) {
      if (!element.isConnected || active.has(element)) return;
      const previous = sizes.get(element);
      sizes.set(element, next);
      if (reduced.matches || !previous || !previous.height || !changed(previous, next)) return;
      const resizeState: ActiveResize = {
        frame: null,
        timer: null,
        originalHeight: element.style.height,
        originalTransition: element.style.transition,
      };
      active.set(element, resizeState);
      element.dataset.resizing = "true";
      element.style.transition = "none";
      element.style.height = `${previous.height}px`;
      void element.offsetWidth;
      resizeState.frame = window.requestAnimationFrame(() => {
        if (active.get(element) !== resizeState) return;
        element.style.transition = resizeState.originalTransition;
        element.style.height = `${next.height}px`;
        resizeState.timer = window.setTimeout(() => {
          if (active.get(element) === resizeState) restore(element, resizeState);
        }, timingMs("control") + 50);
      });
    }

    const observer = new ResizeObserver((entries) => {
      const targets = entries.map((entry) => ({
        element: entry.target as HTMLElement,
        size: read(entry.target as HTMLElement),
      }));
      for (const target of targets) resize(target.element, target.size);
    });
    function register(element: HTMLElement) {
      if (sizes.has(element)) return;
      sizes.set(element, read(element));
      observer.observe(element);
    }
    function visit(node: Node) {
      if (!(node instanceof HTMLElement)) return;
      if (node.matches("[data-resize-motion]")) register(node);
      node.querySelectorAll<HTMLElement>("[data-resize-motion]").forEach(register);
    }
    visit(document.body);
    const mutations = new MutationObserver((records) => {
      const affected = new Set<HTMLElement>();
      for (const record of records) {
        record.addedNodes.forEach(visit);
        let parent = record.target instanceof HTMLElement ? record.target : record.target.parentElement;
        while (parent) {
          if (parent.matches("[data-resize-motion]") && sizes.has(parent)) affected.add(parent);
          parent = parent.parentElement;
        }
      }
      if (viewportWidth !== window.innerWidth) {
        viewportWidth = window.innerWidth;
        for (const element of affected) sizes.set(element, read(element));
        return;
      }
      // Read every natural target before animating any ancestor. This avoids
      // measuring a descendant against an already-animated parent height.
      const targets = [...affected].map((element) => ({ element, size: read(element) }));
      for (const target of targets) resize(target.element, target.size);
      for (const element of sizes.keys()) {
        if (element.isConnected) continue;
        observer.unobserve(element);
        const resizeState = active.get(element);
        if (resizeState) restore(element, resizeState);
        sizes.delete(element);
      }
    });
    mutations.observe(document.body, { childList: true, subtree: true });
    const settleViewport = () => {
      viewportWidth = window.innerWidth;
      for (const [element, resizeState] of active) restore(element, resizeState);
      for (const element of sizes.keys()) {
        if (element.isConnected) sizes.set(element, read(element));
      }
    };
    const stop = () => {
      for (const [element, resizeState] of active) restore(element, resizeState);
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
