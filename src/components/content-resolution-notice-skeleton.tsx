import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ContentResolutionNoticeSkeleton({
  separated = true,
}: {
  separated?: boolean;
}) {
  return (
    <div
      className={cn(
        "space-y-3 px-5 py-5 sm:px-7 sm:py-6",
        separated && "border-t",
      )}
    >
      <div className="flex items-center gap-2">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}
