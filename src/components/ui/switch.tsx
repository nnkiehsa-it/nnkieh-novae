"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Switch({ className, checked, defaultChecked, onCheckedChange, size = "default", id, ...props }:
  Omit<ComponentProps<"input">, "size" | "type" | "onChange"> & {
    size?: "sm" | "default";
    onCheckedChange?: (checked: boolean) => void;
  }) {
  return (
    <label className={cn("toggle shrink-0", className)} data-slot="switch" data-size={size}>
      <input {...props} id={id} type="checkbox" role="switch" checked={checked} defaultChecked={defaultChecked}
        onChange={(event) => onCheckedChange?.(event.currentTarget.checked)} />
      <span className="toggle-icon" />
    </label>
  );
}
