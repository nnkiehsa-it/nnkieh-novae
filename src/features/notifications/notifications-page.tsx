import { AppLink } from "@/ui/app-link";
import { CaretDown, ChatCircle, CheckCircle, Megaphone, Trash, Wrench } from "@phosphor-icons/react/ssr";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { useNotificationsPage } from "@/hooks/use-notifications-page";
import { formatDate } from "@/lib/format";
import { notificationTargetPath } from "@/lib/notification-target";
import { cn } from "@/lib/utils";
import type { NotificationRecord } from "@/types";
import { Button } from "@/ui/button";
import { rowClass } from "@/ui/list";
import { EmptyState, ErrorState, LoadingList, PageHeader } from "@/ui/page";

const TITLE_KEYS: Record<string, string> = {
  announcement_comment_created: "ui.notification.comment",
  announcement_created: "ui.notification.announcement",
  facility_report_created: "ui.notification.facilityCreated",
  facility_status_changed: "ui.notification.facilityUpdated",
  issue_comment_created: "ui.notification.comment",
  issue_created: "ui.notification.issueCreated",
  issue_deleted: "ui.notification.issueDeleted",
  support_goal_met: "ui.notification.goalMet",
};

function NotificationGlyph({ type }: { type: string }) {
  const props = { className: "size-5", weight: "bold" } as const;
  if (type.startsWith("announcement")) return <Megaphone {...props} />;
  if (type.startsWith("facility")) return <Wrench {...props} />;
  if (type.includes("comment")) return <ChatCircle {...props} />;
  if (type === "issue_deleted") return <Trash {...props} />;
  return <CheckCircle {...props} />;
}

function NotificationRow({ notification }: { notification: NotificationRecord }) {
  const { t } = useI18n();
  const target = notificationTargetPath(notification);
  const className = cn(rowClass, "items-start transition-[background-color] duration-[var(--motion-control)] ease-[var(--ease-move)] hover:bg-surface-raised focus-visible:bg-surface-raised");
  const body = (
    <>
      <span aria-hidden className={cn("mt-0.5 grid size-10 shrink-0 place-items-center rounded-full", notification.isRead ? "bg-surface-raised text-ink-muted" : "bg-contrast text-on-contrast")}>
        <NotificationGlyph type={notification.type} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-base text-ink", !notification.isRead && "font-semibold")}>
          {t(TITLE_KEYS[notification.type] ?? "ui.notification.issueUpdated")}
        </span>
        {notification.bodyPreview ? <span className="line-clamp-2 text-sm text-ink-muted">{notification.bodyPreview}</span> : null}
        <span className="mt-1 block text-xs text-ink-faint">{formatDate(notification.createdAt)}</span>
      </span>
      {notification.isRead ? null : <span aria-label={t("notification.unread")} className="mt-2 size-2.5 shrink-0 rounded-full bg-info" />}
    </>
  );
  return (
    <li className="content-in">
      {target ? (
        <AppLink className={className} href={target}>{body}</AppLink>
      ) : (
        <button className={className} onClick={() => toast.info(t("ui.notification.issueGone"))} type="button">{body}</button>
      )}
    </li>
  );
}

export function NotificationsPage() {
  const { t } = useI18n();
  const state = useNotificationsPage();
  const { notifications } = state;

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <PageHeader title={t("ui.nav.notifications")} />
      <div aria-busy={state.loading} className="grid gap-5" data-notification-surface="">
      {state.loading && !notifications.length ? (
        <LoadingList label={t("common.loading")} rows={5} />
      ) : !notifications.length ? (
        state.error
          ? <ErrorState message={state.error} onRetry={() => void state.load()} retryLabel={t("ui.common.reload")} title={t("ui.common.loadFailed")} />
          : <EmptyState description={t("ui.notification.emptyDescription")} title={t("ui.notification.emptyTitle")} />
      ) : (
        <>
          {state.error ? <p className="px-1 text-sm text-danger" role="alert">{state.error}</p> : null}
          <ul className="glass divide-y divide-line overflow-hidden rounded-panel shadow-panel">
            {notifications.map((notification) => <NotificationRow key={notification.id} notification={notification} />)}
          </ul>
          {state.hasMore ? (
            <Button className="justify-self-center" disabled={state.loading} onClick={() => void state.loadMore()} status={state.loadingMore ? "loading" : "idle"}>
              {state.loadingMore ? null : <CaretDown weight="bold" />}
              {t(state.loadingMore ? "ui.common.loadingMore" : "ui.common.loadMore")}
            </Button>
          ) : null}
        </>
      )}
      </div>
    </div>
  );
}
