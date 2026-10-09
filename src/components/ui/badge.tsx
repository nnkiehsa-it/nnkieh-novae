"use client";

import type { ComponentProps } from "react";
import { Badge as F7Badge } from "framework7-react";
import { useFramework7Control } from "./use-framework7-control";

type BadgeProps = ComponentProps<"span"> & {
  color?: string;
  variant?: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link";
};

export function Badge({ color, variant = "default", ref, ...props }: BadgeProps) {
  const nativeRef = useFramework7Control<HTMLSpanElement>(ref, undefined, {});
  return <F7Badge {...props} ref={nativeRef as NonNullable<ComponentProps<typeof F7Badge>["ref"]>}
    data-slot="badge" color={color ?? (variant === "destructive" ? "red" : variant === "default" ? "blue" : "gray")} />;
}
