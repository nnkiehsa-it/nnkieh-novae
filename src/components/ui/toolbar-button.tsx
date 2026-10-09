"use client";

import { Link } from "framework7-react";
import type { ComponentProps } from "react";
import { useFramework7Control } from "./use-framework7-control";
import { cn } from "@/lib/utils";

export function ToolbarButton({ disabled, size: _size, type: _type, title, ...props }: ComponentProps<typeof Link> & {
  disabled?: boolean; size?: string; type?: string; title?: string;
}) {
  const ref = useFramework7Control<HTMLAnchorElement>(undefined, undefined, {
    role: "button", tabindex: disabled ? -1 : 0, "aria-disabled": disabled, title,
  });
  return <Link {...props} className={cn(props.className, disabled && "disabled")} ref={ref as NonNullable<ComponentProps<typeof Link>["ref"]>} href="#" iconOnly
    onClick={(event) => { event.preventDefault(); if (!disabled) props.onClick?.(event); }} />;
}
