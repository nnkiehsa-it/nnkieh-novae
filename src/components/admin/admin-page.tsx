"use client";

import { useRouter } from "next/navigation";
import type * as React from "react";

import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import { SecondaryToolbar } from "@/components/detail-toolbar";
import { PageHeader } from "@/components/ui/page-state";
import { returnToPreviousInAppRoute } from "@/lib/navigation-memory";
import { useAdminDraftExit } from "@/hooks/use-admin-draft-exit";

/**
 * The frame every administration screen wears.
 *
 * Each area is its own route, so each one gets a real title and a real way
 * back; the shell no longer has to say where in a tab strip the reader is.
 */
export function AdminPage({
  actions,
  back = "/admin",
  children,
  title,
}: {
  actions?: React.ReactNode;
  /** Where the back control goes when there is no in-app history to return to. */
  back?: string;
  children: React.ReactNode;
  title: string;
}) {
  useLocaleSubscription();
  const router = useRouter();
  const exit = useAdminDraftExit(undefined, false, () => returnToPreviousInAppRoute(router, back));
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-8">
      <PageHeader
        lead={
          <SecondaryToolbar
            actions={actions}
            backLabel={translate("ui.common.back")}
            backDisabled={exit.blocked}
            onBack={exit.requestClose}
          />
        }
        title={title}
      />
      {children}
      {exit.prompt}
    </div>
  );
}
