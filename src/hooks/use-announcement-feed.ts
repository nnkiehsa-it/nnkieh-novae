"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { useSession } from "@/hooks/use-session";
import {
  fetchAnnouncementsPage,
  setAnnouncementLike,
  type AnnouncementCursor,
} from "@/services/announcements";
import type { AnnouncementSummary } from "@/types";
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
import { getViewMemory, setViewMemory } from "@/lib/view-memory-cache";
import { useColdDataReveal } from "@/hooks/use-cold-data-reveal";
import { toggleReactionState } from "@/lib/reaction-state";
import { advanceFeedPageCount, canLoadAnotherFeedPage } from "@/lib/feed-page-limit";

const ANNOUNCEMENT_LIST_CACHE_PREFIXES = ["announcement-list-page|"] as const;

export function useAnnouncementFeed() {
  const session = useSession();
  const { t } = useI18n();
  const viewMemory = getViewMemory<{
    cursor: AnnouncementCursor;
    hasMore: boolean;
    items: AnnouncementSummary[];
    pageCount: number;
  }>(session.user?.uid, "announcement-feed");
  const [coldRead] = React.useState(() => !viewMemory);
  const [items, setItems] = React.useState<AnnouncementSummary[]>(viewMemory?.items ?? []);
  const [cursor, setCursor] = React.useState<AnnouncementCursor>(viewMemory?.cursor ?? null);
  const [hasMore, setHasMore] = React.useState(viewMemory?.hasMore ?? false);
  const [pageCount, setPageCount] = React.useState(
    viewMemory?.pageCount ?? (viewMemory?.items.length ? 1 : 0),
  );
  const pageCountRef = React.useRef(pageCount);
  const [loading, setLoading] = React.useState(!viewMemory);
  const revealFields = useColdDataReveal(coldRead, loading);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState("");
  const [likingId, setLikingId] = React.useState<string | null>(null);
  const likingRef = React.useRef<string | null>(null);
  const [likeBurstById, setLikeBurstById] = React.useState<Record<string, number>>({});
  const requestGuard = usePagedRequestGuard();
  const entityVersion = useContentEntityDomainVersion(
    session.user?.uid,
    "announcement",
  );
  const queryKey = session.user?.uid ?? "anonymous";

  async function like(announcementId: string) {
    if (likingRef.current) return;
    const announcement =
      getContentEntity<AnnouncementSummary>(
        session.user?.uid,
        "announcement",
        announcementId,
      ) ?? items.find((item) => item.id === announcementId);
    if (!announcement) return;
    const previous = {
      active: announcement.currentUserLiked,
      count: announcement.like_count,
    };
    const optimistic = toggleReactionState(previous);
    likingRef.current = announcementId;
    setLikingId(announcementId);
    patchContentEntity<AnnouncementSummary>(
      session.user?.uid,
      "announcement",
      announcementId,
      {
        currentUserLiked: optimistic.active,
        like_count: optimistic.count,
      },
    );
    if (optimistic.active) {
      setLikeBurstById((current) => ({
        ...current,
        [announcementId]: (current[announcementId] ?? 0) + 1,
      }));
    }
    try {
      const result = await setAnnouncementLike(
        announcementId,
        optimistic.active,
      );
      patchContentEntity<AnnouncementSummary>(
        session.user?.uid,
        "announcement",
        announcementId,
        {
          currentUserLiked: result.liked,
          like_count: result.like_count,
        },
      );
    } catch {
      patchContentEntity<AnnouncementSummary>(
        session.user?.uid,
        "announcement",
        announcementId,
        {
          currentUserLiked: previous.active,
          like_count: previous.count,
        },
      );
      toast.error(t("ui.announcement.likeFailed"));
    } finally {
      likingRef.current = null;
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
            "summary",
          ),
        );
        setItems((current) =>
          nextCursor ? mergePageById(current, announcements) : announcements,
        );
        setCursor(result.cursor);
        const nextPageCount = advanceFeedPageCount(pageCountRef.current, Boolean(nextCursor));
        pageCountRef.current = nextPageCount;
        setPageCount(nextPageCount);
        setHasMore(canLoadAnotherFeedPage(
          nextPageCount,
          canContinuePage(nextCursor, result.cursor, result.hasMore),
        ));
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

  React.useEffect(() => {
    if (loading) return;
    setViewMemory(session.user?.uid, "announcement-feed", {
      cursor,
      hasMore,
      items,
      pageCount,
    }, ANNOUNCEMENT_LIST_CACHE_PREFIXES);
  }, [cursor, hasMore, items, loading, pageCount, session.user?.uid]);

  useContentInvalidationRefresh(
    ANNOUNCEMENT_LIST_CACHE_PREFIXES,
    () => load(null, true),
  );

  const synchronizedItems = items.map(
    (announcement) =>
      getContentEntity<AnnouncementSummary>(
        session.user?.uid,
        "announcement",
        announcement.id,
      ) ?? announcement,
  ).filter((announcement) => !announcement.deleting);
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
    revealFields,
  };
}
