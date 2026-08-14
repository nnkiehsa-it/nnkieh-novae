import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("t-skeleton rounded-md bg-muted/55", className)}
      {...props}
    />
  );
}

export { Skeleton };
