import { ListSection } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";

export function NotificationRowSkeleton() {
  return (
    <div className="flex min-h-[3.25rem] items-start gap-3 py-[var(--row-padding-block)]">
      <Skeleton className="mt-px size-[1.125rem] shrink-0 rounded-md" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <Skeleton className="h-4 w-20 shrink-0" />
    </div>
  );
}

export function NotificationListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ListSection>
      {Array.from({ length: rows }, (_, index) => (
        <NotificationRowSkeleton key={index} />
      ))}
    </ListSection>
  );
}
