"use client";

import { useImperativeHandle, useLayoutEffect, type ComponentProps } from "react";
import { Toggle } from "framework7-react";
import { useFramework7Control } from "./use-framework7-control";
import { cn } from "@/lib/utils";

export function Switch({
  className,
  checked,
  defaultChecked,
  onCheckedChange,
  size = "default",
  id,
  ref,
  ...props
}: Omit<ComponentProps<"input">, "size" | "type" | "onChange"> & {
  size?: "sm" | "default";
  onCheckedChange?: (checked: boolean) => void;
}) {
  const f7Ref = useFramework7Control<HTMLLabelElement>(undefined, undefined, {
    role: "switch",
    tabindex: props.disabled ? -1 : 0,
    "aria-checked": String(checked ?? defaultChecked ?? false),
    "aria-disabled": props.disabled,
    "aria-label": props["aria-label"],
    "aria-labelledby": props["aria-labelledby"],
  });
  useImperativeHandle(ref, () => f7Ref.current.el!.querySelector<HTMLInputElement>("input")!);
  useLayoutEffect(() => {
    const root = f7Ref.current.el!;
    const input = root.querySelector<HTMLInputElement>("input")!;
    if (id) input.id = id;
    else input.removeAttribute("id");
    // Capture activation before React restores F7's controlled input.
    const change = (event: MouseEvent) => {
      if (event.target === input) onCheckedChange?.(input.checked);
    };
    const activate = (event: KeyboardEvent) => {
      if ((event.key === " " || event.key === "Enter") && !props.disabled) {
        event.preventDefault();
        input.click();
      }
    };
    root.addEventListener("keydown", activate);
    root.addEventListener("click", change, true);
    return () => {
      root.removeEventListener("keydown", activate);
      root.removeEventListener("click", change, true);
    };
  }, [f7Ref, id, onCheckedChange, props.disabled]);
  return (
    <Toggle
      {...(props as ComponentProps<typeof Toggle>)}
      className={cn("shrink-0", className)}
      data-slot="switch"
      data-size={size}
      checked={checked}
      defaultChecked={defaultChecked}
      onToggleChange={(value) => {
        if (value !== (checked ?? defaultChecked ?? false)) onCheckedChange?.(value);
      }}
      ref={f7Ref as NonNullable<ComponentProps<typeof Toggle>["ref"]>}
    />
  );
}
