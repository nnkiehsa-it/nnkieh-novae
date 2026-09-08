"use client";

import { t } from "@/i18n";
import { PageHeader } from "@/components/ui/page-state";
import { NotificationListSkeleton } from "@/components/notifications/notification-skeleton";
import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-5">
      <PageHeader title={t("ui.nav.notifications")} />
      <Card className="gap-0 overflow-hidden py-0"><NotificationListSkeleton /></Card>
    </div>
  );
}
