"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

const TOOLTIP_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
const TooltipEnabledContext = React.createContext(false);

function subscribeToTooltipCapability(onChange: () => void) {
  const media = window.matchMedia(TOOLTIP_POINTER_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getTooltipCapability() {
  return window.matchMedia(TOOLTIP_POINTER_QUERY).matches;
}

function TooltipProvider({
  delayDuration = 80,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  const enabled = React.useSyncExternalStore(
    subscribeToTooltipCapability,
    getTooltipCapability,
    () => false,
  );
  return (
    <TooltipEnabledContext.Provider value={enabled}>
      <TooltipPrimitive.Provider
        data-slot="tooltip-provider"
        delayDuration={delayDuration}
        {...props}
      />
    </TooltipEnabledContext.Provider>
  );
}

function Tooltip({
  defaultOpen = false,
  onOpenChange,
  open: controlledOpen,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const enabled = React.useContext(TooltipEnabledContext);
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = enabled && (isControlled ? controlledOpen : uncontrolledOpen);

  React.useEffect(() => {
    if (!enabled && !isControlled) setUncontrolledOpen(false);
  }, [enabled, isControlled]);

  return (
    <TooltipPrimitive.Root
      data-slot="tooltip"
      {...props}
      onOpenChange={(nextOpen) => {
        if (!enabled) return;
        if (!isControlled) setUncontrolledOpen(nextOpen);
        onOpenChange?.(nextOpen);
      }}
      open={open}
    />
  );
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 8,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "t-tooltip z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-lg bg-popover px-3 py-2 text-xs text-balance text-popover-foreground shadow-[var(--shadow-floating)]",
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-popover fill-popover" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
