"use client";

import type { ReactNode } from "react";

import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import { SecondaryToolbar } from "@/components/detail-toolbar";
import { PageHeader } from "@/components/ui/page-state";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The frame an administration route wears while it loads, matching AdminPage's
 * geometry so the title and the first row do not move when the data arrives.
 *
 * The back control is the real one rather than a grey stand-in: it is the one
 * thing on the page that already works while the rest is still arriving, and
 * drawing a placeholder over it made it look disabled and then change shape
 * once the route committed.
 */
export function AdminPageSkeleton({ children }: { children: ReactNode }) {
  useLocaleSubscription();
  return (
    <div aria-busy="true" className="mx-auto w-full max-w-4xl space-y-6 pb-8">
      <PageHeader
        lead={
          <SecondaryToolbar
            backLabel={translate("ui.common.back")}
            onBack={() => window.history.back()}
          />
        }
        title={<Skeleton className="h-8 w-56" />}
      />
      {children}
    </div>
  );
}
