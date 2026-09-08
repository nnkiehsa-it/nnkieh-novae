"use client";

import { useEffect } from "react";

// CSS handles explicit sizes. Observe intrinsic content sizes so auto -> auto
// changes use the same timing without scaling text or replacing the surface.
export function ResizeMotion() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sizes = new Map<HTMLElement, { width: number; height: number }>();
    const animations = new Map<HTMLElement, Animation>();
    const read = (element: HTMLElement) => ({ width: element.offsetWidth, height: element.offsetHeight });
    const changed = (a: { width: number; height: number }, b: { width: number; height: number }) =>
      Math.abs(a.width - b.width) > 1 || Math.abs(a.height - b.height) > 1;

    function resize(element: HTMLElement, next = read(element)) {
      if (!element.isConnected || animations.has(element)) return;
      const previous = sizes.get(element);
      sizes.set(element, next);
      if (reduced.matches || !previous || !previous.width || !previous.height || !changed(previous, next)) return;
      const style = getComputedStyle(element);
      const duration = Number.parseFloat(style.getPropertyValue("--resize-dur")) || 300;
      const animation = element.animate(
        { width: [`${previous.width}px`, `${next.width}px`], height: [`${previous.height}px`, `${next.height}px`] },
        { duration, easing: style.getPropertyValue("--resize-ease").trim(), fill: "none" },
      );
      animation.id = "novae-resize";
      animations.set(element, animation);
      element.dataset.resizing = "true";
      animation.onfinish = () => {
        animations.delete(element);
        delete element.dataset.resizing;
        resize(element);
      };
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) resize(entry.target as HTMLElement);
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
        animations.get(element)?.cancel();
        animations.delete(element);
        sizes.delete(element);
      }
    });
    mutations.observe(document.body, { childList: true, subtree: true });
    const stop = () => {
      for (const [element, animation] of animations) {
        animation.cancel();
        delete element.dataset.resizing;
        sizes.set(element, read(element));
      }
      animations.clear();
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
