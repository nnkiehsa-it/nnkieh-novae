import * as React from "react";
import { useI18n } from "@/i18n";
import { useSession } from "@/hooks/use-session";
import { announcementKeys, listAnnouncements, setAnnouncementLike } from "@/services/announcements";
import { markAnnouncementsOpened } from "@/services/announcement-notice";
import type { AnnouncementCursor } from "@shared/contracts/announcements.ts";
import type { AnnouncementSummary } from "@/types";
import { patchEntity } from "@/lib/query-client";
import { useOptimisticReaction } from "@/hooks/use-optimistic-reaction";
import { usePagedQuery } from "@/hooks/use-paged-query";

export function useAnnouncementFeed() {
  const session = useSession();
  const { t } = useI18n();
  const reaction = useOptimisticReaction();
  const feed = usePagedQuery({
    queryKey: announcementKeys.list(),
    read: (cursor: AnnouncementCursor | null, signal) => listAnnouncements(cursor, signal),
    items: (page) => page.announcements,
  });

  // Reading the newest page is what opens the list, whether it came from the cache or not.
  const openedThrough = feed.firstPage?.snapshotAt;
  React.useEffect(() => {
    if (openedThrough) void markAnnouncementsOpened(openedThrough).catch(() => undefined);
  }, [openedThrough]);

  async function like(announcementId: string) {
    const announcement = feed.items.find((item) => item.id === announcementId);
    if (!announcement) return;
    return reaction.run({
      id: announcementId,
      previous: { active: announcement.currentUserLiked, count: announcement.likeCount },
      apply: ({ active, count }) =>
        patchEntity<AnnouncementSummary>("announcements", announcementId, { currentUserLiked: active, likeCount: count }),
      request: async (active) => {
        const result = await setAnnouncementLike(announcementId, active);
        return { active: result.liked, count: result.likeCount };
      },
      errorMessage: t("ui.announcement.likeFailed"),
    });
  }

  return {
    canManage: session.can("announcement.manage"),
    error: feed.error,
    hasMore: feed.hasMore,
    items: feed.items,
    like,
    likeBurstById: reaction.burstById,
    isLiking: reaction.isBusy,
    loading: feed.loading,
    loadingMore: feed.loadingMore,
    loadMore: feed.loadMore,
    reload: feed.reload,
  };
}
