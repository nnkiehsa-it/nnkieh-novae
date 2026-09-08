import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return <div aria-busy="true" className="divide-y">{Array.from({ length: rows }, (_, index) => (
    <div className="flex items-center gap-3 px-4 py-4" key={index}>
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-3 w-3/5" /></div>
    </div>
  ))}</div>;
}
