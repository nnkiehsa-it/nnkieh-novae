import { cn } from "@/lib/utils";

/**
 * A progressive blur along one edge of the screen: content passing under it
 * softens gradually instead of meeting a hard cut or a tinted band. Six layers
 * double their blur toward the edge, each masked to an overlapping band.
 */
export function EdgeBlur({ className, side }: { className?: string; side: "top" | "bottom" }) {
  return (
    <div aria-hidden className={cn("edge-blur pointer-events-none fixed inset-x-0 z-20", side === "top" ? "top-0" : "bottom-0", className)} data-side={side}>
      <span /><span /><span /><span /><span /><span />
    </div>
  );
}
