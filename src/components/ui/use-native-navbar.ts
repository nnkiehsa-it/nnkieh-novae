"use client";

import { useLayoutEffect, type RefObject } from "react";
import { f7 } from "framework7-react";

type PageWithNavbar = HTMLElement & { f7DetachNavbarScrollHandlers?: () => void };
type ScrollNavbar = typeof f7.navbar & {
  initNavbarOnScroll(page: HTMLElement, navbar: HTMLElement, hide: boolean, collapse: boolean, transparent: boolean): void;
};

export function useNativeNavbarSize(ref: RefObject<{ el: HTMLElement | null }>, enabled = true) {
  useLayoutEffect(() => {
    if (!enabled) return;
    const navbar = ref.current.el!;
    f7.navbar.size(navbar);
    const observer = new ResizeObserver(() => f7.navbar.size(navbar));
    navbar.querySelectorAll(".navbar-inner > .left, .navbar-inner > .title, .navbar-inner > .right").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [enabled, ref]);
}

/** Next owns page creation; attach the same F7 scroll lifecycle its router uses. */
export function useNativeNavbar(ref: RefObject<{ el: HTMLElement | null }>, enabled: boolean, hasSubnavbar = false) {
  useNativeNavbarSize(ref, enabled);
  useLayoutEffect(() => {
    if (!enabled) return;
    const navbar = ref.current.el!;
    const page = navbar.closest<PageWithNavbar>(".novae-page")!;
    page.classList.add("page-with-navbar-large");
    page.classList.toggle("page-with-subnavbar", hasSubnavbar);
    const observer = new ResizeObserver(() => f7.emit("resize"));
    observer.observe(page.querySelector(".novae-page-content")!.firstElementChild!);
    (f7.navbar as ScrollNavbar).initNavbarOnScroll(page, navbar, false, true, false);
    return () => {
      observer.disconnect();
      page.f7DetachNavbarScrollHandlers!();
      page.classList.remove("page-with-navbar-large", "page-with-navbar-large-collapsed", "page-with-subnavbar");
    };
  }, [enabled, hasSubnavbar, ref]);
}
