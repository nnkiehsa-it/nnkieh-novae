"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n";
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

interface FacilityFeed {
  cursor: FacilityCursor | null;
  facilities: FacilitySummary[];
  hasMore: boolean;
}

export function useFacilityFeed() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categories = useCategories();
  const { t } = useI18n();
  const requestedCategory = searchParams.get("category");
  const [category, setCategory] = React.useState(
    requestedCategory && findFacilityCategory(requestedCategory)
      ? requestedCategory
      : getDefaultFacilityCategoryId(),
  );
  const [bucket, setBucket] = React.useState<"active" | "closed">("active");
  const [sort, setSort] = React.useState<FacilitySortOption>("latest");
  const [status, setStatus] = React.useState<FacilityStatus | "">("");
  const [query, setQuery] = React.useState("");
  const [committedQuery, setCommittedQuery] = React.useState("");
  const [feed, setFeed] = React.useState<FacilityFeed>({
    cursor: null,
    facilities: [],
    hasMore: false,
  });
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState("");
  const [affectingId, setAffectingId] = React.useState<string | null>(null);
  const [affectBurstById, setAffectBurstById] = React.useState<Record<string, number>>({});

  async function toggleAffected(facilityId: string) {
    if (affectingId) return;
    setAffectingId(facilityId);
    try {
      const result = await toggleFacilityAffected(facilityId);
      setFeed((current) => ({
        ...current,
        facilities: current.facilities.map((facility) =>
          facility.id === facilityId
            ? { ...facility, affected_count: result.affected_count, currentUserAffected: result.affected }
            : facility,
        ),
      }));
      setAffectBurstById((current) => ({
        ...current,
        [facilityId]: (current[facilityId] ?? 0) + 1,
      }));
    } finally {
      setAffectingId(null);
    }
  }

  React.useEffect(() => {
    if (!category && categories.loaded) setCategory(getDefaultFacilityCategoryId());
  }, [categories.loaded, category]);

  const load = React.useCallback(
    async (cursor: FacilityCursor | null = null) => {
      if (!category) return;
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
        setFeed((current) => ({
          ...result,
          facilities: cursor
            ? [...current.facilities, ...result.facilities]
            : result.facilities,
        }));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t("ui.common.loadFailed"));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [bucket, category, committedQuery, sort, status, t],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

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
    feed,
    load,
    loading,
    loadingMore,
    query,
    setBucket,
    setCommittedQuery,
    setQuery,
    setSort,
    setStatus,
    sort,
    toggleAffected,
  };
}
