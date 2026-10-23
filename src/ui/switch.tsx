import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "inline-flex h-7 w-12 shrink-0 items-center rounded-full bg-surface-pressed p-0.5 outline-none transition-[background-color] duration-[var(--motion-control)] ease-[var(--ease-move)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-40 data-[state=checked]:bg-contrast",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="size-6 rounded-full bg-ink-muted transition-[translate,background-color] duration-[var(--motion-control)] ease-[var(--ease-move)] data-[state=checked]:translate-x-5 data-[state=checked]:bg-on-contrast" />
    </SwitchPrimitive.Root>
  );
}
