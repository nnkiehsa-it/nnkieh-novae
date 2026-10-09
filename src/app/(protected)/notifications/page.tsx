"use client";

import { ArrowDown, CheckCircle2, Megaphone, MessageCircle, Trash2, Wrench, type LucideIcon } from "lucide-react";
import { toast } from "@/lib/toast";
import { useI18n } from "@/i18n";
import { useNotificationsPage } from "@/hooks/use-notifications-page";
import { formatDate } from "@/lib/format";
import { notificationTargetPath } from "@/lib/notification-target";
import type { NotificationRecord } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListCustomRow, ListNavRow, ListSection } from "@/components/ui/list";
import { EmptyStateContent, ErrorState, ErrorStateContent, PageHeader } from "@/components/ui/page-state";
import { NotificationRowSkeleton } from "@/components/notifications/notification-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonReveal } from "@/components/ui/skeleton-reveal";

const TITLE_KEYS: Record<string, string> = {
  announcement_comment_created: "ui.notification.comment", announcement_created: "ui.notification.announcement",
  facility_report_created: "ui.notification.facilityCreated", facility_status_changed: "ui.notification.facilityUpdated",
  issue_comment_created: "ui.notification.comment", issue_created: "ui.notification.issueCreated",
  issue_deleted: "ui.notification.issueDeleted", support_goal_met: "ui.notification.goalMet",
};
function notificationIcon(notification: NotificationRecord): LucideIcon {
  if (notification.type.startsWith("announcement")) return Megaphone;
  if (notification.type.startsWith("facility")) return Wrench;
  if (notification.type.includes("comment")) return MessageCircle;
  return notification.type === "issue_deleted" ? Trash2 : CheckCircle2;
}

export default function NotificationsPage() {
  const { t } = useI18n();
  const state = useNotificationsPage();
  const pending = state.loading && !state.notifications.length;
  return <div className="space-y-5">
    <PageHeader title={t("ui.nav.notifications")} />
    {state.error && state.notifications.length ? <ErrorState error={state.error} onRetry={() => void state.load()} /> : null}
    <div aria-busy={state.loading} data-notification-surface>
      <ListSection className="min-w-0">
        {state.error && !state.notifications.length ? (
          <ListCustomRow><ErrorStateContent error={state.error} onRetry={() => void state.load()} /></ListCustomRow>
        ) : pending ? Array.from({ length: 5 }, (_, index) => <ListCustomRow key={index}><NotificationRowSkeleton /></ListCustomRow>)
        : !state.notifications.length ? (
          <ListCustomRow><EmptyStateContent description={t("ui.notification.emptyDescription")} title={t("ui.notification.emptyTitle")} /></ListCustomRow>
        ) : state.notifications.map((notification) => {
          const href = notificationTargetPath(notification) ?? undefined;
          return <ListNavRow key={notification.id} href={href}
            onClick={href ? undefined : () => toast.info(t("ui.notification.issueGone"))}
            icon={notificationIcon(notification)}
            label={<SkeletonReveal as="span" enabled={state.revealFields} stableLayout skeleton={<Skeleton className="display-block h-4 w-24" />}>
              {t(TITLE_KEYS[notification.type] ?? "ui.notification.issueUpdated")}
            </SkeletonReveal>}
            detail={<SkeletonReveal as="span" enabled={state.revealFields} stableLayout skeleton={<Skeleton className="display-block h-3 w-40" />}>
              {notification.body_preview}
            </SkeletonReveal>}
            value={<>{!notification.is_read ? <Badge color="blue" /> : null}<span className="text-xs">{formatDate(notification.created_at)}</span></>}
          />;
        })}
      </ListSection>
    </div>
    {state.hasMore ? <div className="flex justify-center"><Button disabled={state.loading || state.loadingMore}
      onClick={() => void state.loadMore()} variant="outline"><ArrowDown />
      {state.loadingMore ? t("ui.common.loadingMore") : t("ui.common.loadMore")}
    </Button></div> : null}
  </div>;
}
