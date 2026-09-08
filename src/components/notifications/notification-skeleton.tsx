import { Skeleton } from "@/components/ui/skeleton";

export function NotificationRowSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4">
      <Skeleton className="size-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2 py-0.5">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

export function NotificationListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      aria-busy="true"
      className="divide-y overflow-hidden py-0"
      role="status"
    >
      {Array.from({ length: rows }, (_, index) => (
        <NotificationRowSkeleton key={index} />
      ))}
    </div>
  );
}
