import { Avatar as AvatarPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/** A person's photo, falling back to the first letter of their name. */
export function Avatar({ className, name, src }: { className?: string; name: string; src?: string | null }) {
  return (
    <AvatarPrimitive.Root className={cn("relative inline-flex size-10 shrink-0 overflow-hidden rounded-full bg-contrast", className)}>
      {src ? <AvatarPrimitive.Image alt={name} className="size-full object-cover" src={src} /> : null}
      <AvatarPrimitive.Fallback className="grid size-full place-items-center text-sm font-semibold text-on-contrast">
        {name.trim().slice(0, 1).toUpperCase() || "?"}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
