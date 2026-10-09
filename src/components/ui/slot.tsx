"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Compose a native control without an extra wrapper, preserving child handlers. */
export function Slot({ children, ...props }: React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode;
  ref?: React.Ref<HTMLElement>;
}) {
  const child = React.Children.only(children) as React.ReactElement<Record<string, unknown>>;
  const merged = { ...props, ...child.props } as Record<string, unknown>;
  merged.className = cn(props.className, child.props.className as string);
  merged.style = { ...props.style, ...child.props.style as React.CSSProperties };
  for (const key of Object.keys(props)) {
    if (!/^on[A-Z]/u.test(key)) continue;
    const parentHandler = (props as Record<string, unknown>)[key];
    const childHandler = child.props[key];
    if (typeof parentHandler !== "function") continue;
    merged[key] = (event: React.SyntheticEvent) => {
      if (typeof childHandler === "function") childHandler(event);
      if (!event.defaultPrevented) parentHandler(event);
    };
  }
  if (props.ref) {
    merged.ref = (element: HTMLElement | null) => {
      for (const ref of [props.ref, child.props.ref as React.Ref<HTMLElement>]) {
        if (typeof ref === "function") ref(element);
        else if (ref) ref.current = element;
      }
    };
  }
  return React.cloneElement(child, merged);
}
