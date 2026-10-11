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
    // F7 owns the live input; syncing it avoids React restoring its old value.
    if (checked !== undefined) input.checked = checked;
    if (id) input.id = id;
    else input.removeAttribute("id");
    const activate = (event: KeyboardEvent) => {
      if ((event.key === " " || event.key === "Enter") && !props.disabled) {
        event.preventDefault();
        input.click();
      }
    };
    root.addEventListener("keydown", activate);
    return () => root.removeEventListener("keydown", activate);
  }, [checked, f7Ref, id, props.disabled]);
  return (
    <Toggle
      {...(props as ComponentProps<typeof Toggle>)}
      className={cn("shrink-0", className)}
      data-slot="switch"
      data-size={size}
      defaultChecked={checked ?? defaultChecked}
      onToggleChange={onCheckedChange}
      ref={f7Ref as NonNullable<ComponentProps<typeof Toggle>["ref"]>}
    />
  );
}
