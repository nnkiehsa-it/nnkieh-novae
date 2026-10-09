"use client";

import * as React from "react";
import { f7, f7ready } from "framework7-react";
import type { Tooltip as TooltipType } from "framework7/types";
import { Slot } from "./slot";

const TooltipContext = React.createContext<React.RefObject<HTMLElement | null> | null>(null);
export function TooltipProvider({ children }: { children: React.ReactNode; delayDuration?: number }) { return children; }
export function Tooltip({ children }: { children: React.ReactNode }) {
  const target = React.useRef<HTMLElement>(null);
  return <TooltipContext.Provider value={target}>{children}</TooltipContext.Provider>;
}
export function TooltipTrigger({ asChild, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const target = React.useContext(TooltipContext);
  const Comp = asChild ? Slot : "button";
  return <Comp {...props} ref={target as React.RefObject<HTMLButtonElement | null>} />;
}
export function TooltipContent({ children }: { children: React.ReactNode; className?: string; sideOffset?: number }) {
  const target = React.useContext(TooltipContext);
  React.useEffect(() => {
    let disposed = false;
    let tooltip: TooltipType.Tooltip | null = null;
    f7ready(() => {
      if (disposed || !target?.current || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      tooltip = f7.tooltip.create({ targetEl: target.current, text: String(children), trigger: "hover", offset: 8 });
    });
    return () => { disposed = true; tooltip?.destroy(); };
  }, [children, target]);
  return null;
}
