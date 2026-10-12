"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * The shape every administration screen arrives in: grouped bands of rows, so
 * the skeleton and the content have the same geometry and nothing jumps when
 * the data lands.
 */
export function AdminListSkeleton({ groups = 3, rows = 4 }: { groups?: number; rows?: number }) {
  return (
    <div aria-busy="true" className="space-y-6">
      {Array.from({ length: groups }, (_, group) => (
        <div key={group}>
          <Skeleton className="mb-2 ml-1 h-3 w-24" />
          <div className="rule-card rule-list">
            {Array.from({ length: rows }, (_, row) => (
              <div className="flex min-h-[3.25rem] items-center gap-3 py-[var(--row-padding-block)]" key={row}>
                <Skeleton className="h-4 w-40" />
                <span className="flex-1" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
