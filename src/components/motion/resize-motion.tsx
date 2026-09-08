"use client";

import { useEffect } from "react";

interface Size {
  width: number;
  height: number;
}

interface ActiveResize {
  frame: number | null;
  timer: number | null;
  originalHeight: string;
  originalTransition: string;
  originalWidth: string;
}

// Animate the physical box, not its contents. CSS grid items with h-full do
// not reliably interpolate an auto-to-auto Web Animation, so temporarily pin
// the measured box and let the shared CSS transition interpolate the pixels.
export function ResizeMotion() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sizes = new Map<HTMLElement, Size>();
    const active = new Map<HTMLElement, ActiveResize>();
    const read = (element: HTMLElement) => ({ width: element.offsetWidth, height: element.offsetHeight });
    const changed = (a: Size, b: Size) =>
      Math.abs(a.width - b.width) > 1 || Math.abs(a.height - b.height) > 1;

    function restore(element: HTMLElement, resize: ActiveResize) {
      if (resize.frame !== null) window.cancelAnimationFrame(resize.frame);
      if (resize.timer !== null) window.clearTimeout(resize.timer);
      element.style.width = resize.originalWidth;
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
      if (reduced.matches || !previous || !previous.width || !previous.height || !changed(previous, next)) return;
      const style = getComputedStyle(element);
      const duration = Number.parseFloat(style.getPropertyValue("--resize-dur")) || 300;
      const resizeState: ActiveResize = {
        frame: null,
        timer: null,
        originalHeight: element.style.height,
        originalTransition: element.style.transition,
        originalWidth: element.style.width,
      };
      active.set(element, resizeState);
      element.dataset.resizing = "true";
      element.style.transition = "none";
      if (previous.width !== next.width) element.style.width = `${previous.width}px`;
      if (previous.height !== next.height) element.style.height = `${previous.height}px`;
      void element.offsetWidth;
      resizeState.frame = window.requestAnimationFrame(() => {
        if (active.get(element) !== resizeState) return;
        element.style.transition = resizeState.originalTransition;
        if (previous.width !== next.width) element.style.width = `${next.width}px`;
        if (previous.height !== next.height) element.style.height = `${next.height}px`;
        resizeState.timer = window.setTimeout(() => {
          if (active.get(element) === resizeState) restore(element, resizeState);
        }, duration + 50);
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
      if (node.matches(".t-resize")) register(node);
      node.querySelectorAll<HTMLElement>(".t-resize").forEach(register);
    }
    visit(document.body);
    const mutations = new MutationObserver((records) => {
      const affected = new Set<HTMLElement>();
      for (const record of records) {
        record.addedNodes.forEach(visit);
        let parent = record.target instanceof HTMLElement ? record.target : record.target.parentElement;
        while (parent) {
          if (sizes.has(parent)) affected.add(parent);
          parent = parent.parentElement;
        }
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
    const stop = () => {
      for (const [element, resizeState] of active) restore(element, resizeState);
    };
    reduced.addEventListener("change", stop);
    return () => {
      reduced.removeEventListener("change", stop);
      mutations.disconnect();
      observer.disconnect();
      stop();
    };
  }, []);
  return null;
}
