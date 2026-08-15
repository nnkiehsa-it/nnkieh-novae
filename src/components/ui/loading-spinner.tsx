import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingSpinner({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span aria-hidden className={cn("t-loading-spinner", className)} data-slot="loading-spinner">
      <LoaderCircle className={cn("t-spinner", iconClassName)} />
    </span>
  );
}
