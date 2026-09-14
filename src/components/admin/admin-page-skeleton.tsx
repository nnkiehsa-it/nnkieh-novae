"use client";

import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * The frame an administration route wears while it loads, matching AdminPage's
 * geometry so the title and the first row do not move when the data arrives.
 */
export function AdminPageSkeleton({ children }: { children: ReactNode }) {
  return (
    <div aria-busy="true" className="mx-auto w-full max-w-4xl space-y-6 pb-8">
      <div className="flex h-9 items-center">
        <Skeleton className="size-11 rounded-xl md:size-9" />
      </div>
      <div className="pb-4">
        <Skeleton className="h-8 w-56" />
      </div>
      {children}
    </div>
  );
}
