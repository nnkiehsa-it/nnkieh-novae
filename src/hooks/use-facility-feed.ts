import { useI18n } from "@/i18n";
import {
  findFacilityCategory,
  getDefaultFacilityCategoryId,
  useCategories,
} from "@/hooks/use-categories";
import { facilityKeys, listFacilities, toggleFacilityAffected } from "@/services/facilities";
import type { FacilityCursor, FacilitySortOption, FacilityStatus, FacilitySummary } from "@/types";
import { useFeedUrlState } from "@/hooks/use-feed-url-state";
import { readFacilityFeedFilters } from "@/lib/feed-url-state";
import { patchEntity } from "@/lib/query-client";
import { useOptimisticReaction } from "@/hooks/use-optimistic-reaction";
import { usePagedQuery } from "@/hooks/use-paged-query";
import { toFacilityStatusCounts } from "@/constants/statuses";

export function useFacilityFeed() {
  const { params: searchParams, committedQuery, query, setCommittedQuery, setQuery, updateParams } = useFeedUrlState();
  const { bucket, sort, status } = readFacilityFeedFilters(searchParams);
  const categories = useCategories();
  const { t } = useI18n();
  const requestedCategory = searchParams.get("category");
  const category = requestedCategory && findFacilityCategory(requestedCategory)
    ? requestedCategory : getDefaultFacilityCategoryId();
  const reaction = useOptimisticReaction();

  const feed = usePagedQuery({
    enabled: Boolean(category),
    queryKey: facilityKeys.list({ category, bucket, sort, status, query: committedQuery }),
    read: (cursor: FacilityCursor | null, signal) => listFacilities({
      bucket,
      categoryId: category,
      cursor,
      query: committedQuery,
      sort,
      status,
    }, signal),
    items: (page) => page.facilities,
  });

  async function toggleAffected(facilityId: string) {
    const facility = feed.items.find((item) => item.id === facilityId);
    if (!facility) return;
    return reaction.run({
      id: facilityId,
      previous: { active: facility.currentUserAffected, count: facility.affectedCount },
      apply: ({ active, count }) =>
        patchEntity<FacilitySummary>("facilities", facilityId, { affectedCount: count, currentUserAffected: active }),
      request: async () => {
        const result = await toggleFacilityAffected(facilityId);
        return { active: result.affected, count: result.affectedCount };
      },
      errorMessage: t("ui.facility.affectedFailed"),
    });
  }

  return {
    bucket,
    affectBurstById: reaction.burstById,
    isAffecting: reaction.isBusy,
    categories: categories.activeFacilityCategories,
    category,
    changeCategory: (value: string) => {
      if (findFacilityCategory(value)) updateParams({ category: value });
    },
    committedQuery,
    error: feed.error,
    feed: {
      facilities: feed.items,
      hasMore: feed.hasMore,
      // The counts describe the whole category; only a first page carries them.
      statusCounts: feed.firstPage?.statusCounts ?? toFacilityStatusCounts({}),
    },
    loading: feed.loading,
    loadingMore: feed.loadingMore,
    loadMore: feed.loadMore,
    query,
    reload: feed.reload,
    setBucket: (value: "active" | "closed") => updateParams({ bucket: value === "active" ? null : value, status: null }),
    setCommittedQuery,
    setQuery,
    setSort: (value: FacilitySortOption) => updateParams({ sort: value === "latest" ? null : value }),
    setStatus: (value: FacilityStatus | "") => updateParams({ status: value || null }),
    sort,
    toggleAffected,
  };
}
