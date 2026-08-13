"use client";

import * as React from "react";
import { useI18n } from "@/i18n";
import { useSession } from "@/hooks/use-session";
import {
  fetchAnnouncementsPage,
  setAnnouncementLike,
  type AnnouncementCursor,
} from "@/services/announcements";
import type { AnnouncementRecord } from "@/types";
import { reconcileReactionState, recordReactionMutation } from "@/lib/reaction-state";

export function useAnnouncementFeed() {
  const session = useSession();
  const { t } = useI18n();
  const [items, setItems] = React.useState<AnnouncementRecord[]>([]);
  const [cursor, setCursor] = React.useState<AnnouncementCursor>(null);
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState("");
  const [likingId, setLikingId] = React.useState<string | null>(null);
  const [likeBurstById, setLikeBurstById] = React.useState<Record<string, number>>({});

  async function like(announcementId: string) {
    if (likingId) return;
    const announcement = items.find((item) => item.id === announcementId);
    if (!announcement) return;
    setLikingId(announcementId);
    try {
      const result = await setAnnouncementLike(
        announcementId,
        !announcement.currentUserLiked,
      );
      recordReactionMutation(session.user?.uid, "announcement", announcementId, {
        active: result.liked,
        count: result.like_count,
      });
      setItems((current) =>
        current.map((item) =>
          item.id === announcementId
            ? { ...item, currentUserLiked: result.liked, like_count: result.like_count }
            : item,
        ),
      );
      setLikeBurstById((current) => ({
        ...current,
        [announcementId]: (current[announcementId] ?? 0) + 1,
      }));
    } finally {
      setLikingId(null);
    }
  }

  const load = React.useCallback(
    async (nextCursor: AnnouncementCursor = null) => {
      nextCursor ? setLoadingMore(true) : setLoading(true);
      setError("");
      try {
        const result = await fetchAnnouncementsPage(nextCursor, 10, {
          cacheScope: session.user?.uid,
        });
        const announcements = result.announcements.map((announcement) => {
          const reaction = reconcileReactionState(
            session.user?.uid,
            "announcement",
            announcement.id,
            { active: announcement.currentUserLiked, count: announcement.like_count },
            "list",
          );
          return {
            ...announcement,
            currentUserLiked: reaction.active,
            like_count: reaction.count,
          };
        });
        setItems((current) =>
          nextCursor ? [...current, ...announcements] : announcements,
        );
        setCursor(result.cursor);
        setHasMore(result.hasMore);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t("ui.common.loadFailed"));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [session.user?.uid, t],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  return {
    canManage: session.can("announcement.manage"),
    cursor,
    error,
    hasMore,
    items,
    like,
    likeBurstById,
    likingId,
    load,
    loading,
    loadingMore,
  };
}
