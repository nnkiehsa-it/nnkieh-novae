"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCategories } from "@/hooks/use-categories";
import { useSession } from "@/hooks/use-session";
import { useContentInvalidationRefresh } from "@/hooks/use-content-invalidation-refresh";
import { fetchIssuesPageByStatus } from "@/services/issues";
import { listFacilities } from "@/services/facilities";
import { toFacilityStatusCounts, toIssueStatusCounts } from "@/constants/statuses";
import { getViewMemory, setViewMemory } from "@/lib/view-memory-cache";

const COUNT_CACHE_PREFIXES = ["issue-list-page|", "facility-list-page|"] as const;

function sumCounts<T extends string>(empty: Record<T, number>, pages: { statusCounts: Record<T, number> }[]) {
  for (const page of pages) {
    for (const status of Object.keys(empty) as T[]) empty[status] += page.statusCounts[status];
  }
  return empty;
}

/** First-page metadata counts every status in a category, regardless of bucket. */
export function useHomeStatusCounts() {
  const { user, isAdmin } = useSession();
  const { activeIssueCategories, activeFacilityCategories, issuesEnabled, facilitiesEnabled, loaded } = useCategories();
  const uid = user?.uid;
  const cacheKey = `home-status-counts|${isAdmin}|${issuesEnabled ? activeIssueCategories.map((category) => category.id).join(',') : ''}|${facilitiesEnabled ? activeFacilityCategories.map((category) => category.id).join(',') : ''}`;
  const emptyCounts = () => ({ issues: toIssueStatusCounts({}), facilities: toFacilityStatusCounts({}) });
  const remembered = getViewMemory<ReturnType<typeof emptyCounts>>(uid, cacheKey);
  const controllerRef = useRef<AbortController | null>(null);
  const [counts, setCounts] = useState(() => remembered ?? emptyCounts());
  const hasCounts = useRef(Boolean(remembered));
  const [loading, setLoading] = useState(!remembered);
  const [error, setError] = useState(false);

  const load = useCallback(async (forceRefresh = false) => {
    if (!uid || !loaded) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(!hasCounts.current);
    setError(false);
    try {
      const [issues, facilities] = await Promise.all([
        Promise.all((issuesEnabled ? activeIssueCategories : []).map((category) =>
          fetchIssuesPageByStatus(uid, category.id, "active", null, {
            isAdmin, forceRefresh: forceRefresh || hasCounts.current, signal: controller.signal, pageSize: 1,
          }),
        )),
        Promise.all((facilitiesEnabled ? activeFacilityCategories : []).map((category) =>
          listFacilities({ categoryId: category.id, bucket: "active" }, {
            forceRefresh: forceRefresh || hasCounts.current, signal: controller.signal, pageSize: 1,
          }),
        )),
      ]);
      if (controller.signal.aborted) return;
      const next = {
        issues: sumCounts(toIssueStatusCounts({}), issues),
        facilities: sumCounts(toFacilityStatusCounts({}), facilities),
      };
      hasCounts.current = true;
      setCounts(next);
      setViewMemory(uid, cacheKey, next, COUNT_CACHE_PREFIXES);
    } catch {
      if (!controller.signal.aborted && !hasCounts.current) setError(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [uid, isAdmin, issuesEnabled, facilitiesEnabled, activeIssueCategories, activeFacilityCategories, cacheKey, loaded]);

  useEffect(() => {
    void load();
    return () => controllerRef.current?.abort();
  }, [load]);
  useContentInvalidationRefresh(COUNT_CACHE_PREFIXES, () => load(true));
  return { ...counts, loading, error, retry: () => load(true) };
}
