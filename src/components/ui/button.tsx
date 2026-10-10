"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@/components/ui/slot";
import { Button as Framework7Button } from "framework7-react";
import { useFramework7Control } from "./use-framework7-control";
import { DialogButtonsContext } from "./dialog-buttons-context";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "button novae-button w-auto shrink-0 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "button-fill",
        destructive: "button-fill color-red",
        outline: "button-outline",
        secondary: "button-tonal",
        ghost: "",
        link: "link",
      },
      size: {
        default: "",
        xs: "button-small",
        sm: "button-small",
        lg: "button-large",
        icon: "button-round button-large novae-icon-button",
        // Room enough for a label once there is room for one; a square icon until then.
        adaptive: "button-round button-large novae-icon-button sm:w-auto",
        "icon-xs": "button-round button-small novae-icon-button",
        "icon-sm": "button-round novae-icon-button",
        "icon-lg": "button-round button-large novae-icon-button",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ref,
  type = "button",
  disabled,
  form,
  name,
  value,
  title,
  tabIndex,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const inDialog = React.useContext(DialogButtonsContext);
  const appearance = inDialog && (variant === "outline" || variant === "ghost" || variant === "link") ? "secondary" : variant;
  const f7Ref = useFramework7Control<HTMLButtonElement>(
    asChild ? undefined : ref,
    undefined,
    {
      disabled,
      form,
      name,
      value:
        typeof value === "string" || typeof value === "number"
          ? value
          : undefined,
      title,
      tabindex: tabIndex,
    },
    !asChild,
  );
  const common = {
    "data-slot": "button",
    "data-control-label": "",
    "data-variant": variant,
    "data-size": size,
    className: cn(buttonVariants({ variant: appearance, size }), inDialog && "dialog-button button-round button-large", className),
    ...props,
  };
  if (asChild) return <Slot {...common} ref={ref} />;

  return (
    <Framework7Button {...common} type={type} disabled={disabled} ref={f7Ref} />
  );
}

export { Button, buttonVariants };
