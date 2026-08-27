"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { useSession } from "@/hooks/use-session";
import {
  fetchNotificationSnapshot,
  fetchNotificationSourcePages,
  markNotificationsOpened,
  subscribeNotificationSource,
  type NotificationCursor,
} from "@/services/notifications";
import type { NotificationRecord, NotificationSource } from "@/types";
import { getViewMemory, setViewMemory } from "@/lib/view-memory-cache";
import { useColdDataReveal } from "@/hooks/use-cold-data-reveal";
import {
  advanceFeedPageCount,
  canLoadAnotherFeedPage,
  limitRetainedFeedItems,
  MAX_RETAINED_FEED_PAGES,
} from "@/lib/feed-page-limit";
import { NOTIFICATION_FEED_PAGE_SIZE } from "@/lib/page-size";
import { notificationTargetPath } from "@/lib/notification-target";

const sourceOrder: NotificationSource[] = ["broadcast", "admin", "user"];
const sourceRecord = <T,>(value: () => T): Record<NotificationSource, T> => ({
  admin: value(),
  broadcast: value(),
  user: value(),
});

export function useNotificationsPage() {
  const router = useRouter();
  const session = useSession();
  const { t } = useI18n();
  const activeSources = React.useMemo<NotificationSource[]>(
    () => (session.isAdmin ? sourceOrder : ["broadcast", "user"]),
    [session.isAdmin],
  );
  const viewMemory = getViewMemory<{
    cursors: Record<NotificationSource, NotificationCursor>;
    more: Record<NotificationSource, boolean>;
    pageCounts: Record<NotificationSource, number>;
    pages: Record<NotificationSource, NotificationRecord[]>;
  }>(session.user?.uid, "notifications");
  const [coldRead] = React.useState(() => !viewMemory);
  const [pages, setPages] = React.useState<
    Record<NotificationSource, NotificationRecord[]>
  >(viewMemory?.pages ?? sourceRecord(() => []));
  const [cursors, setCursors] = React.useState<
    Record<NotificationSource, NotificationCursor>
  >(viewMemory?.cursors ?? sourceRecord(() => null));
  const [more, setMore] = React.useState<Record<NotificationSource, boolean>>(
    viewMemory?.more ?? sourceRecord(() => false),
  );
  const [pageCounts, setPageCounts] = React.useState<Record<NotificationSource, number>>(
    viewMemory?.pageCounts ?? sourceRecord(() => 0),
  );
  const [loading, setLoading] = React.useState(!viewMemory);
  const revealFields = useColdDataReveal(coldRead, loading);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    if (!session.user) return;
    if (coldRead) setLoading(true);
    setError("");
    try {
      const snapshot = await fetchNotificationSnapshot(
        activeSources,
        session.user.uid,
      );
      setPages((current) => ({
        ...current,
        ...Object.fromEntries(
          activeSources.map((source) => [
            source,
            snapshot.pages[source].notifications,
          ]),
        ),
      }));
      setCursors((current) => ({
        ...current,
        ...Object.fromEntries(
          activeSources.map((source) => [source, snapshot.pages[source].cursor]),
        ),
      }));
      setMore((current) => ({
        ...current,
        ...Object.fromEntries(
          activeSources.map((source) => [source, snapshot.pages[source].hasMore]),
        ),
      }));
      setPageCounts((current) => ({
        ...current,
        ...Object.fromEntries(activeSources.map((source) => [source, 1])),
      }));
      await markNotificationsOpened().catch(() => undefined);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t("notification.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [activeSources, coldRead, session.user, t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleRealtimeResync = React.useCallback(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (loading) return;
    setViewMemory(session.user?.uid, "notifications", {
      cursors,
      more,
      pageCounts,
      pages,
    }, ["notification-pages|"]);
  }, [cursors, loading, more, pageCounts, pages, session.user?.uid]);

  React.useEffect(() => {
    if (!session.user) return;
    const unsubscribes = activeSources.map((source) =>
      subscribeNotificationSource(
        source,
        session.user!.uid,
        (notification) =>
          setPages((current) => ({
            ...current,
            [source]: limitRetainedFeedItems([
              notification,
              ...current[source].filter((item) => item.id !== notification.id),
            ], NOTIFICATION_FEED_PAGE_SIZE),
          })),
        undefined,
        handleRealtimeResync,
      ),
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [activeSources, handleRealtimeResync, session.user]);

  const notifications = React.useMemo(
    () =>
      activeSources
        .flatMap((source) => pages[source])
        .toSorted(
          (left, right) =>
            (right.created_at?.getTime() ?? 0) -
              (left.created_at?.getTime() ?? 0) ||
            right.id.localeCompare(left.id),
        ),
    [activeSources, pages],
  );
  const hasMore = activeSources.some(
    (source) => more[source] && cursors[source] && pageCounts[source] < MAX_RETAINED_FEED_PAGES,
  );

  const loadMore = React.useCallback(async () => {
    if (!session.user || loadingMore) return;
    const requests = activeSources.flatMap((source) =>
      more[source] && cursors[source] && pageCounts[source] < MAX_RETAINED_FEED_PAGES
        ? [{ cursor: cursors[source], source }]
        : [],
    );
    if (requests.length === 0) return;
    setLoadingMore(true);
    try {
      const result = await fetchNotificationSourcePages(
        requests,
        session.user.uid,
      );
      const nextPageCounts = { ...pageCounts };
      for (const source of activeSources) {
        const page = result[source];
        if (!page) continue;
        const nextPageCount = advanceFeedPageCount(pageCounts[source], true);
        nextPageCounts[source] = nextPageCount;
        setPages((current) => ({
          ...current,
          [source]: limitRetainedFeedItems([
            ...current[source],
            ...page.notifications.filter(
              (item) =>
                !current[source].some((existing) => existing.id === item.id),
            ),
          ], NOTIFICATION_FEED_PAGE_SIZE),
        }));
        setCursors((current) => ({ ...current, [source]: page.cursor }));
        setMore((current) => ({
          ...current,
          [source]: canLoadAnotherFeedPage(nextPageCount, page.hasMore),
        }));
      }
      setPageCounts(nextPageCounts);
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : t("ui.notification.loadMoreFailed"),
      );
    } finally {
      setLoadingMore(false);
    }
  }, [activeSources, cursors, loadingMore, more, pageCounts, session.user, t]);

  const open = React.useCallback(
    (notification: NotificationRecord) => {
      const target = notificationTargetPath(notification);
      if (!target) {
        toast.info(t("ui.notification.issueGone"));
        return;
      }
      router.push(target);
    },
    [router, t],
  );

  const preload = React.useCallback((notification: NotificationRecord) => {
    const target = notificationTargetPath(notification);
    if (target) router.prefetch(target);
  }, [router]);

  return { error, hasMore, load, loadMore, loading, loadingMore, notifications, open, preload, revealFields };
}
