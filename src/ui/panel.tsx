import * as React from "react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/** The floating glass card every grouped piece of content sits on. */
export function Panel({
  asChild = false,
  className,
  interactive = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean; interactive?: boolean }) {
  const Component = asChild ? Slot.Root : "div";
  return (
    <Component
      className={cn(
        "glass block rounded-panel p-4 text-ink shadow-panel md:p-5",
        interactive &&
          "outline-none transition-[background-color,transform] duration-[var(--motion-control)] ease-[var(--ease-move)] hover:bg-surface-pressed active:scale-[var(--motion-card-press-scale)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
        className,
      )}
      {...props}
    />
  );
}

/** A quieter surface nested inside a panel, such as one figure in a row of figures. */
export function Tile({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-tile bg-surface-raised p-4", className)} {...props} />;
}

export function SectionTitle({ action, children, className }: {
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-8 items-center justify-between gap-3 px-1", className)}>
      <h2 className="text-[0.8125rem] font-medium text-ink-muted">{children}</h2>
      {action}
    </div>
  );
}
