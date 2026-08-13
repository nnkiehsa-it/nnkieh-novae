import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type FeedSkeletonKind = "announcement" | "facility" | "issue";

const FEED_SKELETON_COUNTS: Record<FeedSkeletonKind, number> = {
  announcement: 10,
  facility: 20,
  issue: 30,
};

function ToolbarSkeleton() {
  return (
    <div className="flex h-9 items-center justify-between" aria-hidden>
      <Skeleton className="size-9 rounded-xl" />
      <div className="flex gap-1">
        <Skeleton className="size-9 rounded-xl" />
        <Skeleton className="size-9 rounded-xl" />
      </div>
    </div>
  );
}

function FeedCardSkeleton({ index, kind }: { index: number; kind: FeedSkeletonKind }) {
  const hasSummary = kind !== "facility";
  const hasProgress = kind === "issue" && index % 2 === 0;
  return (
    <Card className="route-card-skeleton min-h-36 gap-4 p-5 sm:p-6">
      <div className="flex justify-between gap-4">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-5 w-4/5" />
        </div>
        <Skeleton className="size-4" />
      </div>
      {hasSummary ? (
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ) : null}
      {hasProgress ? (
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      ) : null}
      <div className="mt-auto flex items-center gap-2 border-t pt-3">
        {kind !== "announcement" ? <Skeleton className="h-6 w-20 rounded-full" /> : null}
        {kind === "facility" ? <Skeleton className="h-4 w-24" /> : null}
        <Skeleton className="ml-auto h-8 w-20 rounded-lg" />
        {kind === "announcement" ? <Skeleton className="h-8 w-12 rounded-lg" /> : null}
      </div>
    </Card>
  );
}

export function ListRouteSkeleton({ kind }: { kind: FeedSkeletonKind }) {
  const filters = kind !== "announcement";
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <div className="flex min-h-9 items-center justify-between gap-3">
        <Skeleton className="h-8 w-36" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-xl" />
          {filters ? <Skeleton className="h-8 w-28 rounded-full" /> : null}
        </div>
      </div>
      {filters ? (
        <Card className="gap-0 p-2">
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1 rounded-xl" />
            <Skeleton className="h-10 w-20 rounded-xl sm:w-36" />
          </div>
        </Card>
      ) : null}
      <FeedCardsSkeleton kind={kind} />
    </div>
  );
}

export function FeedCardsSkeleton({ kind }: { kind: FeedSkeletonKind }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2 lg:items-stretch" aria-busy="true">
      {Array.from({ length: FEED_SKELETON_COUNTS[kind] }, (_, index) => (
        <FeedCardSkeleton index={index} key={index} kind={kind} />
      ))}
    </div>
  );
}

export function DetailRouteSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <ToolbarSkeleton />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <Card className="min-h-[25rem] gap-0 overflow-hidden py-0">
          <div className="space-y-3 border-b px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-8 w-4/5" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="space-y-3 px-5 py-5 sm:px-7 sm:py-6">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </Card>
        <Card className="min-h-40 gap-4 p-5 sm:p-6">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-12" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="mx-auto h-9 w-24 rounded-xl" />
        </Card>
      </div>
    </div>
  );
}

export function ComposerRouteSkeleton({ extraFields = false }: { extraFields?: boolean }) {
  return (
    <div className="mx-auto max-w-3xl space-y-5" aria-busy="true" aria-label="Loading">
      <div className="flex min-h-9 items-center justify-between gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-20 rounded-xl" />
      </div>
      <Card className="py-6">
        <div className="grid gap-5 px-5 sm:px-7">
          {extraFields ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <Skeleton className="ml-auto h-9 w-24 rounded-xl" />
        </div>
      </Card>
    </div>
  );
}
