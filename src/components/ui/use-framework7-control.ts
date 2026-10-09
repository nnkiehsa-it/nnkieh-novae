"use client";

import { useId, useImperativeHandle, useLayoutEffect, useRef, type Ref } from "react";

export function applyNativeControlAttributes(target: HTMLElement, attributes: Record<string, string | number | boolean | undefined>) {
  Object.entries(attributes).forEach(([name, value]) => {
    const aria = name.startsWith("aria-");
    if (value === undefined || (value === false && !aria)) target.removeAttribute(name);
    else target.setAttribute(name, value === true && !aria ? "" : String(value));
  });
  if (!["button", "menuitem", "combobox"].includes(String(attributes.role)) || target instanceof HTMLButtonElement) return;
  const activate = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " " || (attributes.role === "combobox" && event.key === "ArrowDown")) {
      event.preventDefault();
      if (target.getAttribute("aria-disabled") === "true") return;
      target.click();
    }
  };
  target.addEventListener("keydown", activate);
  return () => target.removeEventListener("keydown", activate);
}

// F7 9.2 ListItem does not expose its normal row through its public ref.
// Its id is passed to the actual li; use that documented attribute boundary.
export function useFramework7ListControl(attributes: Record<string, string | number | boolean | undefined>, selector = "a") {
  const id = useId();
  useLayoutEffect(() => applyNativeControlAttributes(document.getElementById(id)!.querySelector<HTMLElement>(selector)!, attributes));
  return id;
}

/** F7 refs expose {el}; bridge existing DOM refs and attributes to its control. */
export function useFramework7Control<T extends HTMLElement>(
  ref: Ref<T> | undefined,
  selector: string | undefined,
  attributes: Record<string, string | number | boolean | undefined>,
  enabled = true,
) {
  const component = useRef<{ el: HTMLElement | null }>({ el: null });
  const node = () =>
    selector
      ? component.current.el!.querySelector<T>(selector)!
      : (component.current.el! as T);
  useImperativeHandle(enabled ? ref : undefined, node, [selector]);
  useLayoutEffect(() => {
    if (!enabled) return;
    const target = node();
    return applyNativeControlAttributes(target, attributes);
  });
  return component;
}
