"use client";

import { t } from "@/i18n";
import { LoadingState, PageHeader } from "@/components/ui/page-state";

export default function Loading() {
  return (
    <div className="space-y-5">
      <PageHeader title={t("ui.nav.notifications")} />
      <LoadingState />
    </div>
  );
}
