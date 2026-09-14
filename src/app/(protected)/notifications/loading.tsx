"use client";

import { t } from "@/i18n";
import { PageHeader } from "@/components/ui/page-state";
import { NotificationListSkeleton } from "@/components/notifications/notification-skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" className="space-y-5" role="status">
      <PageHeader title={t("ui.nav.notifications")} />
      <NotificationListSkeleton />
    </div>
  );
}
