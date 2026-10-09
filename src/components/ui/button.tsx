"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@/components/ui/slot";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "button novae-button shrink-0 font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "button-fill",
        destructive: "button-fill color-red",
        outline: "button-outline",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary-hover",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-[var(--tint-content)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2 has-[svg]:px-4",
        xs: "h-6 gap-1 px-2.5 has-[svg]:px-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-3.5 has-[svg]:px-3",
        lg: "h-12 px-7 has-[svg]:px-5",
        icon: "size-9",
        // Room enough for a label once there is room for one; a square icon until then.
        adaptive: "size-9 px-0 sm:w-auto sm:px-4 sm:has-[svg]:px-3.5",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
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
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      data-control-label=""
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };

