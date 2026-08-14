"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { useSession } from "@/hooks/use-session";
import {
  findFacilityCategory,
  getDefaultFacilityCategoryId,
  useCategories,
} from "@/hooks/use-categories";
import { listFacilities, toggleFacilityAffected } from "@/services/facilities";
import type {
  FacilityCursor,
  FacilitySortOption,
  FacilityStatus,
  FacilitySummary,
} from "@/types";
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
import { waitForMinimumSkeletonDuration } from "@/lib/loading-timing";
import { useColdDataReveal } from "@/hooks/use-cold-data-reveal";
import { toggleReactionState } from "@/lib/reaction-state";

const FACILITY_LIST_CACHE_PREFIXES = ["facility-list-page|"] as const;

interface FacilityFeed {
  cursor: FacilityCursor | null;
  facilities: FacilitySummary[];
  hasMore: boolean;
}

interface FacilityFeedViewMemory {
  bucket: "active" | "closed";
  category: string;
  committedQuery: string;
  feed: FacilityFeed;
  query: string;
  sort: FacilitySortOption;
  status: FacilityStatus | "";
}

export function useFacilityFeed() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categories = useCategories();
  const session = useSession();
  const { t } = useI18n();
  const requestedCategory = searchParams.get("category");
  const viewMemory = getViewMemory<FacilityFeedViewMemory>(
    session.user?.uid,
    "facility-feed",
  );
  const [coldRead] = React.useState(() => !viewMemory);
  const [category, setCategory] = React.useState(
    requestedCategory && findFacilityCategory(requestedCategory)
      ? requestedCategory
      : viewMemory?.category || getDefaultFacilityCategoryId(),
  );
  const [bucket, setBucket] = React.useState<"active" | "closed">(viewMemory?.bucket ?? "active");
  const [sort, setSort] = React.useState<FacilitySortOption>(viewMemory?.sort ?? "latest");
  const [status, setStatus] = React.useState<FacilityStatus | "">(viewMemory?.status ?? "");
  const [query, setQuery] = React.useState(viewMemory?.query ?? "");
  const [committedQuery, setCommittedQuery] = React.useState(viewMemory?.committedQuery ?? "");
  const [feed, setFeed] = React.useState<FacilityFeed>({
    cursor: viewMemory?.feed.cursor ?? null,
    facilities: viewMemory?.feed.facilities ?? [],
    hasMore: viewMemory?.feed.hasMore ?? false,
  });
  const [loading, setLoading] = React.useState(!viewMemory);
  const revealFields = useColdDataReveal(coldRead, loading);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState("");
  const [affectingId, setAffectingId] = React.useState<string | null>(null);
  const affectingRef = React.useRef<string | null>(null);
  const [affectBurstById, setAffectBurstById] = React.useState<Record<string, number>>({});
  const requestGuard = usePagedRequestGuard();
  const entityVersion = useContentEntityDomainVersion(session.user?.uid, "facility");
  const queryKey = [
    session.user?.uid ?? "",
    category,
    bucket,
    sort,
    status,
    committedQuery,
  ].join("|");

  async function toggleAffected(facilityId: string) {
    if (affectingRef.current) return;
    const facility =
      getContentEntity<FacilitySummary>(
        session.user?.uid,
        "facility",
        facilityId,
      ) ?? feed.facilities.find((item) => item.id === facilityId);
    if (!facility) return;
    const previous = {
      active: facility.currentUserAffected,
      count: facility.affected_count,
    };
    const optimistic = toggleReactionState(previous);
    affectingRef.current = facilityId;
    setAffectingId(facilityId);
    patchContentEntity<FacilitySummary>(
      session.user?.uid,
      "facility",
      facilityId,
      {
        affected_count: optimistic.count,
        currentUserAffected: optimistic.active,
      },
    );
    if (optimistic.active) {
      setAffectBurstById((current) => ({
        ...current,
        [facilityId]: (current[facilityId] ?? 0) + 1,
      }));
    }
    try {
      const result = await toggleFacilityAffected(facilityId);
      patchContentEntity<FacilitySummary>(
        session.user?.uid,
        "facility",
        facilityId,
        {
          affected_count: result.affected_count,
          currentUserAffected: result.affected,
        },
      );
    } catch {
      patchContentEntity<FacilitySummary>(
        session.user?.uid,
        "facility",
        facilityId,
        {
          affected_count: previous.count,
          currentUserAffected: previous.active,
        },
      );
      toast.error(t("ui.facility.affectedFailed"));
    } finally {
      affectingRef.current = null;
      setAffectingId(null);
    }
  }

  React.useEffect(() => {
    if (!category && categories.loaded) setCategory(getDefaultFacilityCategoryId());
  }, [categories.loaded, category]);

  const load = React.useCallback(
    async (cursor: FacilityCursor | null = null, restart = false) => {
      if (!category) return;
      if (restart) requestGuard.restart(queryKey);
      const requestToken = requestGuard.begin(queryKey);
      if (!requestToken) return;
      const entityReadRevision = beginContentEntityRead();
      const skeletonStartedAt = !cursor && coldRead ? Date.now() : 0;
      cursor ? setLoadingMore(true) : setLoading(true);
      setError("");
      try {
        const result = await listFacilities({
          bucket,
          categoryId: category,
          cursor,
          query: committedQuery,
          sort,
          status,
        });
        if (!requestGuard.isCurrent(requestToken)) return;
        const facilities = result.facilities.map((facility) =>
          mergeContentEntityRead(
            session.user?.uid,
            "facility",
            facility,
            entityReadRevision,
            "summary",
          ),
        );
        setFeed((current) => ({
          ...result,
          hasMore: canContinuePage(cursor, result.cursor, result.hasMore),
          facilities: cursor
            ? mergePageById(current.facilities, facilities)
            : facilities,
        }));
      } catch (caught) {
        if (requestGuard.isCurrent(requestToken))
          setError(caught instanceof Error ? caught.message : t("ui.common.loadFailed"));
      } finally {
        if (skeletonStartedAt)
          await waitForMinimumSkeletonDuration(skeletonStartedAt);
        if (requestGuard.finish(requestToken)) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [
      bucket,
      category,
      committedQuery,
      queryKey,
      requestGuard,
      coldRead,
      session.user?.uid,
      sort,
      status,
      t,
    ],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (loading) return;
    setViewMemory<FacilityFeedViewMemory>(
      session.user?.uid,
      "facility-feed",
      {
        bucket,
        category,
        committedQuery,
        feed,
        query,
        sort,
        status,
      },
      FACILITY_LIST_CACHE_PREFIXES,
    );
  }, [bucket, category, committedQuery, feed, loading, query, session.user?.uid, sort, status]);

  useContentInvalidationRefresh(FACILITY_LIST_CACHE_PREFIXES, () => load(null, true));

  const synchronizedFeed = {
    ...feed,
    facilities: feed.facilities.map(
      (facility) =>
        getContentEntity<FacilitySummary>(
          session.user?.uid,
          "facility",
          facility.id,
        ) ?? facility,
    ).filter((facility) => !facility.deleting),
  };
  void entityVersion;

  return {
    bucket,
    affectBurstById,
    affectingId,
    categories: categories.activeFacilityCategories,
    category,
    changeCategory: (value: string) => {
      setCategory(value);
      router.replace(`/facilities?category=${encodeURIComponent(value)}`);
    },
    committedQuery,
    error,
    feed: synchronizedFeed,
    load,
    loading,
    loadingMore,
    query,
    revealFields,
    setBucket,
    setCommittedQuery,
    setQuery,
    setSort,
    setStatus,
    sort,
    toggleAffected,
  };
}
