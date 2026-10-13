import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Check } from "@phosphor-icons/react/ssr";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";
import { Spinner } from "./feedback";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap outline-none select-none transition-[background-color,color,opacity,transform] duration-[var(--motion-control)] ease-[var(--ease-move)] active:scale-[var(--motion-press-scale)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1.125rem]",
  {
    variants: {
      variant: {
        primary: "bg-contrast text-on-contrast hover:bg-contrast/90",
        secondary: "glass-control border text-ink hover:bg-surface-pressed",
        ghost: "text-ink-muted hover:bg-surface-raised hover:text-ink",
        danger: "bg-danger/15 text-danger hover:bg-danger/25",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-[0.9375rem]",
        lg: "h-12 px-6 text-base",
        icon: "size-11",
        "icon-sm": "size-9",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

/** Where the action the button started has got to; anything but `idle` holds the button. */
export type ActionStatus = "idle" | "loading" | "success";

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean; status?: ActionStatus };

export function Button({
  asChild = false,
  children,
  className,
  disabled,
  size,
  status = "idle",
  type,
  variant,
  ...props
}: ButtonProps) {
  const className_ = cn(buttonVariants({ size, variant }), className);
  if (asChild) return <Slot.Root className={className_} {...props}>{children}</Slot.Root>;
  return (
    <button
      aria-busy={status === "loading" || undefined}
      className={className_}
      disabled={disabled || status !== "idle"}
      type={type ?? "button"}
      {...props}
    >
      {status === "loading" ? <Spinner className="size-4 border-current border-t-transparent" /> : null}
      {status === "success" ? <Check aria-hidden weight="bold" /> : null}
      {children}
    </button>
  );
}
