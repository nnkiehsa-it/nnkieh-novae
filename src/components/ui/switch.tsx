"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Switch({
  className,
  size = "default",
  onPointerDown,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default";
}) {
  const [touched, setTouched] = React.useState(false);

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      data-touched={touched}
      className={cn(
        "t-toggle peer group/switch inline-flex shrink-0 items-center rounded-full border border-transparent shadow-[var(--shadow-control)] outline-none transition-[background-color,border-color,box-shadow] duration-150 [--toggle-travel:14px] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-5 data-[size=default]:w-8 data-[size=sm]:h-4 data-[size=sm]:w-6 data-[size=sm]:[--toggle-travel:10px] data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/80",
        className,
      )}
      onPointerDown={(event) => {
        setTouched(true);
        onPointerDown?.(event);
      }}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "t-toggle-thumb pointer-events-none block rounded-full bg-background ring-0 group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 dark:data-[state=checked]:bg-primary-foreground dark:data-[state=unchecked]:bg-foreground",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
