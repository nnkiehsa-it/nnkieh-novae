"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { useSession } from "@/hooks/use-session";
import { fetchAnnouncementRecordById } from "@/services/announcements";
import { getFacility } from "@/services/facilities";
import { fetchIssueRecordById } from "@/services/issues";
import {
  fetchNotificationSnapshot,
  fetchNotificationSourcePages,
  markNotificationsOpened,
  subscribeNotificationSource,
  type NotificationCursor,
} from "@/services/notifications";
import type { NotificationRecord, NotificationSource } from "@/types";
import { getViewMemory, setViewMemory } from "@/lib/view-memory-cache";
import { waitForMinimumSkeletonDuration } from "@/lib/loading-timing";
import { useColdDataReveal } from "@/hooks/use-cold-data-reveal";

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
  const [loading, setLoading] = React.useState(!viewMemory);
  const revealFields = useColdDataReveal(coldRead, loading);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    if (!session.user) return;
    const skeletonStartedAt = coldRead ? Date.now() : 0;
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
      await markNotificationsOpened().catch(() => undefined);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t("notification.loadFailed"),
      );
    } finally {
      if (skeletonStartedAt)
        await waitForMinimumSkeletonDuration(skeletonStartedAt);
      setLoading(false);
    }
  }, [activeSources, coldRead, session.user, t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (loading) return;
    setViewMemory(session.user?.uid, "notifications", {
      cursors,
      more,
      pages,
    }, ["notification-pages|"]);
  }, [cursors, loading, more, pages, session.user?.uid]);

  React.useEffect(() => {
    if (!session.user) return;
    const unsubscribes = activeSources.map((source) =>
      subscribeNotificationSource(source, session.user!.uid, (notification) =>
        setPages((current) => ({
          ...current,
          [source]: [
            notification,
            ...current[source].filter((item) => item.id !== notification.id),
          ],
        })),
      ),
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [activeSources, session.user]);

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
    (source) => more[source] && cursors[source],
  );

  const loadMore = React.useCallback(async () => {
    if (!session.user || loadingMore) return;
    const requests = activeSources.flatMap((source) =>
      more[source] && cursors[source]
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
      for (const source of activeSources) {
        const page = result[source];
        if (!page) continue;
        setPages((current) => ({
          ...current,
          [source]: [
            ...current[source],
            ...page.notifications.filter(
              (item) =>
                !current[source].some((existing) => existing.id === item.id),
            ),
          ],
        }));
        setCursors((current) => ({ ...current, [source]: page.cursor }));
        setMore((current) => ({ ...current, [source]: page.hasMore }));
      }
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : t("ui.notification.loadMoreFailed"),
      );
    } finally {
      setLoadingMore(false);
    }
  }, [activeSources, cursors, loadingMore, more, session.user, t]);

  const open = React.useCallback(
    async (notification: NotificationRecord) => {
      if (notification.type === "issue_deleted") {
        toast.info(t("ui.notification.issueGone"));
        return;
      }
      try {
        const query = notification.type.includes("comment")
          ? `?tab=comments${notification.comment_id ? `&comment=${encodeURIComponent(notification.comment_id)}` : ""}`
          : "";
        if (notification.target_type === "announcement") {
          const item = await fetchAnnouncementRecordById(notification.target_id);
          router.push(`/announcements/${item.id}${query}`);
          return;
        }
        if (notification.target_type === "facility") {
          const item = await getFacility(notification.target_id);
          router.push(`/facilities/${item.id}`);
          return;
        }
        const item = await fetchIssueRecordById(notification.target_id);
        router.push(
          `/issues/${encodeURIComponent(item.category)}/${item.id}${query}`,
        );
      } catch {
        toast.error(t("ui.notification.contentUnavailable"));
      }
    },
    [router, t],
  );

  return { error, hasMore, load, loadMore, loading, loadingMore, notifications, open, revealFields };
}
