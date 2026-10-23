import * as React from "react";
import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { useSession } from "@/hooks/use-session";
import {
  fetchNotificationSnapshot,
  fetchNotificationSourcePages,
  markNotificationsOpened,
  notificationKeys,
  subscribeNotificationSource,
  type NotificationCursor,
  type NotificationPages,
} from "@/services/notifications";
import type { NotificationRecord, NotificationSource } from "@/types";
import { invalidateLists, queryClient } from "@/lib/query-client";
import { canContinuePage } from "@/lib/pagination";
import { canLoadAnotherFeedPage, limitRetainedFeedItems } from "@/lib/feed-page-limit";
import { NOTIFICATION_FEED_PAGE_SIZE } from "@/lib/page-size";

const sourceOrder: NotificationSource[] = ["broadcast", "admin", "user"];
type SourceCursors = Partial<Record<NotificationSource, NotificationCursor>>;

/**
 * Where each source goes on from: its newest page, if it says there is more and
 * the feed has not reached its page limit.
 */
function nextCursors(pages: NotificationPages[], sources: NotificationSource[]): SourceCursors | undefined {
  const next: SourceCursors = {};
  for (const source of sources) {
    const read = pages.flatMap((page) => page[source] ? [page[source]] : []);
    const latest = read.at(-1);
    if (!latest) continue;
    const continues = canContinuePage(read.at(-2)?.cursor ?? null, latest.cursor, latest.hasMore);
    if (latest.cursor && canLoadAnotherFeedPage(read.length, continues)) next[source] = latest.cursor;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/** Every source the account may read, newest first, a page of each at a time. */
export function useNotificationsPage() {
  const session = useSession();
  const { t } = useI18n();
  const uid = session.user?.uid;
  const sources = React.useMemo<NotificationSource[]>(
    () => (session.isAdmin ? sourceOrder : ["broadcast", "user"]),
    [session.isAdmin],
  );
  const query = useInfiniteQuery({
    enabled: Boolean(uid),
    queryKey: notificationKeys.list(sources),
    initialPageParam: null as SourceCursors | null,
    queryFn: async ({ pageParam, signal }) => {
      if (!pageParam) return (await fetchNotificationSnapshot(sources, { signal })).pages;
      const requests = sources.flatMap((source) => {
        const cursor = pageParam[source];
        return cursor ? [{ cursor, source }] : [];
      });
      return await fetchNotificationSourcePages(requests, signal);
    },
    getNextPageParam: (_last, pages) => nextCursors(pages, sources),
  });

  // Reading the newest page is what opens the notifications.
  const firstPage = query.data?.pages[0];
  React.useEffect(() => {
    if (firstPage) void markNotificationsOpened().catch(() => undefined);
  }, [firstPage]);

  React.useEffect(() => {
    if (!uid) return;
    const prepend = (source: NotificationSource, notification: NotificationRecord) =>
      queryClient.setQueryData<InfiniteData<NotificationPages>>(notificationKeys.list(sources), (data) => {
        const page = data?.pages[0]?.[source];
        if (!data || !page) return data;
        const notifications = limitRetainedFeedItems([
          notification,
          ...page.notifications.filter((item) => item.id !== notification.id),
        ], NOTIFICATION_FEED_PAGE_SIZE);
        return { ...data, pages: [{ ...data.pages[0], [source]: { ...page, notifications } }, ...data.pages.slice(1)] };
      });
    const resync = () => void invalidateLists("notifications");
    const unsubscribes = sources.map((source) =>
      subscribeNotificationSource(source, uid, (notification) => prepend(source, notification), undefined, resync),
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [sources, uid]);

  const notifications = React.useMemo(() => {
    const byId = new Map<string, NotificationRecord>();
    for (const page of query.data?.pages ?? []) {
      for (const source of sources) {
        for (const notification of page[source]?.notifications ?? []) byId.set(notification.id, notification);
      }
    }
    return [...byId.values()].toSorted(
      (left, right) =>
        Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
        right.id.localeCompare(left.id),
    );
  }, [query.data, sources]);

  return {
    error: query.isError && !query.isFetchNextPageError
      ? query.error.message || t("notification.loadFailed")
      : "",
    hasMore: query.hasNextPage,
    load: async () => {
      await query.refetch();
    },
    loadMore: async () => {
      if (!query.hasNextPage || query.isFetching) return;
      const result = await query.fetchNextPage({ cancelRefetch: false });
      if (result.isFetchNextPageError) toast.error(result.error.message || t("ui.notification.loadMoreFailed"));
    },
    loading: query.isLoading,
    loadingMore: query.isFetchingNextPage,
    notifications,
  };
}
