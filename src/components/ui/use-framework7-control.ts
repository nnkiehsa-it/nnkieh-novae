"use client";

import { useId, useImperativeHandle, useLayoutEffect, useRef, type Ref } from "react";

function applyAttributes(target: HTMLElement, attributes: Record<string, string | number | boolean | undefined>) {
  Object.entries(attributes).forEach(([name, value]) => {
    if (value === undefined || value === false) target.removeAttribute(name);
    else target.setAttribute(name, value === true ? "" : String(value));
  });
  if (attributes.role !== "button" || target instanceof HTMLButtonElement) return;
  const activate = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      target.click();
    }
  };
  target.addEventListener("keydown", activate);
  return () => target.removeEventListener("keydown", activate);
}

// F7 9.2 ListItem does not expose its normal row through its public ref.
// Its id is passed to the actual li; use that documented attribute boundary.
export function useFramework7ListControl(attributes: Record<string, string | number | boolean | undefined>) {
  const id = useId();
  useLayoutEffect(() => applyAttributes(document.getElementById(id)!.querySelector<HTMLAnchorElement>("a")!, attributes));
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
  useImperativeHandle(ref, node);
  useLayoutEffect(() => {
    if (!enabled) return;
    const target = node();
    return applyAttributes(target, attributes);
  });
  return component;
}
