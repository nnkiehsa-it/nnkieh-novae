import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const chipVariants = cva(
  "inline-flex h-6 shrink-0 items-center gap-1 rounded-chip border px-2 text-[0.8125rem] font-medium leading-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "border-line bg-surface-raised text-ink",
        positive: "border-positive/20 bg-positive/12 text-positive",
        caution: "border-caution/20 bg-caution/12 text-caution",
        danger: "border-danger/20 bg-danger/12 text-danger",
        info: "border-info/20 bg-info/12 text-info",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

/** A short verb or state set in front of a line of text, like "Confirm" or "審核中". */
export function Chip({ className, tone, ...props }: React.ComponentProps<"span"> & VariantProps<typeof chipVariants>) {
  return <span className={cn(chipVariants({ tone }), className)} {...props} />;
}
