"use client";

import {
  ArrowDown,
  CheckCircle2,
  ChevronRight,
  Megaphone,
  MessageCircle,
  Trash2,
  Wrench,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { useNotificationsPage } from "@/hooks/use-notifications-page";
import { formatDate } from "@/lib/format";
import type { NotificationRecord } from "@/types";
import { StaggerItem, StaggerList } from "@/components/motion/stagger";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  PageHeader,
} from "@/components/ui/page-state";
import { NotificationListSkeleton } from "@/components/notifications/notification-skeleton";

function notificationTitle(notification: NotificationRecord, t: (key: string) => string) {
  if (notification.type === "announcement_created")
    return t("ui.notification.announcement");
  if (
    notification.type === "announcement_comment_created" ||
    notification.type === "issue_comment_created"
  )
    return t("ui.notification.comment");
  if (notification.type === "facility_status_changed")
    return t("ui.notification.facilityUpdated");
  if (notification.type === "facility_report_created")
    return t("ui.notification.facilityCreated");
  if (notification.type === "issue_created")
    return t("ui.notification.issueCreated");
  if (notification.type === "issue_deleted")
    return t("ui.notification.issueDeleted");
  if (notification.type === "support_goal_met")
    return t("ui.notification.goalMet");
  return t("ui.notification.issueUpdated");
}

function NotificationIcon({ notification }: { notification: NotificationRecord }) {
  const Icon = notification.type.startsWith("announcement")
    ? Megaphone
    : notification.type.startsWith("facility")
      ? Wrench
      : notification.type.includes("comment")
        ? MessageCircle
        : notification.type === "issue_deleted"
          ? Trash2
          : CheckCircle2;
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
      <Icon className="size-[1.125rem]" />
    </span>
  );
}

export default function NotificationsPage() {
  const { t } = useI18n();
  const state = useNotificationsPage();
  return (
    <div className="space-y-5">
      <PageHeader
        title={t("ui.nav.notifications")}
      />
      {state.error && state.notifications.length === 0 ? (
        <ErrorState error={state.error} onRetry={() => void state.load()} />
      ) : state.loading ? (
        <NotificationListSkeleton />
      ) : state.notifications.length === 0 ? (
        <EmptyState
          description={t("ui.notification.emptyDescription")}
          title={t("ui.notification.emptyTitle")}
        />
      ) : (
        <StaggerList className="overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)]">
          {state.notifications.map((notification) => (
            <StaggerItem key={notification.id}>
              <button
                className="group flex w-full items-start gap-3 border-b p-4 text-left outline-none last:border-b-0 hover:bg-[var(--surface-hover)] focus-visible:bg-[var(--surface-hover)]"
                onClick={() => void state.open(notification)}
                type="button"
              >
                <NotificationIcon notification={notification} />
                <span className="t-stagger-copy min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-medium leading-5">
                      {notificationTitle(notification, t)}
                    </span>
                    {!notification.is_read ? (
                      <span
                        className="t-notification-badge mt-1.5 size-2 shrink-0 rounded-full bg-blue-500"
                        data-open="true"
                      />
                    ) : null}
                  </span>
                  {notification.body_preview ? (
                    <span className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                      {notification.body_preview}
                    </span>
                  ) : null}
                  <span className="mt-1.5 block text-xs text-muted-foreground">
                    {formatDate(notification.created_at)}
                  </span>
                </span>
                <ChevronRight className="mt-3 size-4 shrink-0 text-muted-foreground transition-transform duration-250 group-hover:translate-x-0.5" />
              </button>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
      {state.hasMore ? (
        <div className="flex justify-center">
          <Button
            disabled={state.loadingMore}
            onClick={() => void state.loadMore()}
            variant="outline"
          >
            <ArrowDown />
            {state.loadingMore
              ? t("ui.common.loadingMore")
              : t("ui.common.loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
