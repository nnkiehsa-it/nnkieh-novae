"use client";

import { Link } from "framework7-react";
import type { ComponentProps, Ref } from "react";
import { useFramework7Control } from "./use-framework7-control";
import { cn } from "@/lib/utils";

export function ToolbarButton({ disabled, ref: forwardedRef, title, ...props }: Omit<ComponentProps<typeof Link>, "ref"> & {
  disabled?: boolean; title?: string; ref?: Ref<HTMLAnchorElement>;
}) {
  const ref = useFramework7Control<HTMLAnchorElement>(forwardedRef, undefined, {
    role: "button", tabindex: disabled ? -1 : 0, "aria-disabled": disabled, title,
  });
  // React owns this action; skip F7's router-level preventDefault before React handlers.
  return <Link {...props} external className={cn(props.className, disabled && "disabled")} ref={ref as NonNullable<ComponentProps<typeof Link>["ref"]>} href="#" iconOnly
    onClick={(event) => { if (!disabled) props.onClick?.(event); event.preventDefault(); }} />;
}
