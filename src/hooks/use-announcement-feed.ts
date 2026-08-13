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
import {
  beginContentEntityRead,
  getContentEntity,
  mergeContentEntityRead,
  patchContentEntity,
} from "@/lib/content-entity-store";
import { canContinuePage, mergePageById } from "@/lib/pagination";
import { usePagedRequestGuard } from "@/hooks/use-paged-request-guard";
import { useContentEntityDomainVersion } from "@/hooks/use-content-entity";

import { useContentInvalidationRefresh } from "@/hooks/use-content-invalidation-refresh";

const ANNOUNCEMENT_LIST_CACHE_PREFIXES = ["announcement-list-page|"] as const;

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
  const requestGuard = usePagedRequestGuard();
  const entityVersion = useContentEntityDomainVersion(
    session.user?.uid,
    "announcement",
  );
  const queryKey = session.user?.uid ?? "anonymous";

  async function like(announcementId: string) {
    if (likingId) return;
    const announcement =
      getContentEntity<AnnouncementRecord>(
        session.user?.uid,
        "announcement",
        announcementId,
      ) ?? items.find((item) => item.id === announcementId);
    if (!announcement) return;
    setLikingId(announcementId);
    try {
      const result = await setAnnouncementLike(
        announcementId,
        !announcement.currentUserLiked,
      );
      patchContentEntity<AnnouncementRecord>(
        session.user?.uid,
        "announcement",
        announcementId,
        {
          currentUserLiked: result.liked,
          like_count: result.like_count,
        },
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
    async (nextCursor: AnnouncementCursor = null, restart = false) => {
      if (restart) requestGuard.restart(queryKey);
      const requestToken = requestGuard.begin(queryKey);
      if (!requestToken) return;
      const entityReadRevision = beginContentEntityRead();
      nextCursor ? setLoadingMore(true) : setLoading(true);
      setError("");
      try {
        const result = await fetchAnnouncementsPage(nextCursor, 10, {
          cacheScope: session.user?.uid,
        });
        if (!requestGuard.isCurrent(requestToken)) return;
        const announcements = result.announcements.map((announcement) =>
          mergeContentEntityRead(
            session.user?.uid,
            "announcement",
            announcement,
            entityReadRevision,
          ),
        );
        setItems((current) =>
          nextCursor ? mergePageById(current, announcements) : announcements,
        );
        setCursor(result.cursor);
        setHasMore(
          canContinuePage(nextCursor, result.cursor, result.hasMore),
        );
      } catch (caught) {
        if (requestGuard.isCurrent(requestToken))
          setError(caught instanceof Error ? caught.message : t("ui.common.loadFailed"));
      } finally {
        if (requestGuard.finish(requestToken)) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [queryKey, requestGuard, session.user?.uid, t],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  useContentInvalidationRefresh(
    ANNOUNCEMENT_LIST_CACHE_PREFIXES,
    () => load(null, true),
  );

  const synchronizedItems = items.map(
    (announcement) =>
      getContentEntity<AnnouncementRecord>(
        session.user?.uid,
        "announcement",
        announcement.id,
      ) ?? announcement,
  );
  void entityVersion;

  return {
    canManage: session.can("announcement.manage"),
    cursor,
    error,
    hasMore,
    items: synchronizedItems,
    like,
    likeBurstById,
    likingId,
    load,
    loading,
    loadingMore,
  };
}
