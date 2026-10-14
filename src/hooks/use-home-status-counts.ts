"use client";

import { useQueries } from "@tanstack/react-query";
import { useCategories } from "@/hooks/use-categories";
import { useSession } from "@/hooks/use-session";
import { getIssueStatusCounts, issueKeys } from "@/services/issues";
import { facilityKeys, getFacilityStatusCounts } from "@/services/facilities";
import { toFacilityStatusCounts, toIssueStatusCounts, type FacilityStatusCounts, type IssueStatusCounts } from "@/constants/statuses";

function sum<T extends string>(empty: Record<T, number>, counts: Array<Record<T, number> | undefined>) {
  for (const each of counts) {
    if (!each) continue;
    for (const status of Object.keys(empty) as T[]) empty[status] += each[status];
  }
  return empty;
}

/** First-page metadata counts every status in a category, regardless of bucket. */
export function useHomeStatusCounts() {
  const { user } = useSession();
  const { activeIssueCategories, activeFacilityCategories, issuesEnabled, facilitiesEnabled, loaded } = useCategories();
  const enabled = Boolean(user) && loaded;
  const issueCategories = issuesEnabled ? activeIssueCategories : [];
  const facilityCategories = facilitiesEnabled ? activeFacilityCategories : [];
  const issues = useQueries({
    queries: issueCategories.map((category) => ({
      enabled,
      queryKey: issueKeys.counts(category.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => getIssueStatusCounts(category.id, signal),
    })),
  });
  const facilities = useQueries({
    queries: facilityCategories.map((category) => ({
      enabled,
      queryKey: facilityKeys.counts(category.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => getFacilityStatusCounts(category.id, signal),
    })),
  });
  const all = [...issues, ...facilities];
  // The overview adds categories together, so it shows them only once every one has arrived.
  const complete = all.every((query) => query.data);
  const issueCounts = complete ? issues.map((query) => query.data) : [];
  const facilityCounts = complete ? facilities.map((query) => query.data) : [];
  return {
    issues: sum(toIssueStatusCounts({}), issueCounts),
    facilities: sum(toFacilityStatusCounts({}), facilityCounts),
    // Per category as well, so a category-scoped manager sees only what is theirs.
    issuesByCategory: Object.fromEntries(issueCategories.flatMap((category, index) =>
      issueCounts[index] ? [[category.id, issueCounts[index]]] : [])) as Record<string, IssueStatusCounts>,
    facilitiesByCategory: Object.fromEntries(facilityCategories.flatMap((category, index) =>
      facilityCounts[index] ? [[category.id, facilityCounts[index]]] : [])) as Record<string, FacilityStatusCounts>,
    loading: !complete && all.some((query) => query.isLoading),
    error: !complete && all.some((query) => query.isError),
    retry: () => all.forEach((query) => void query.refetch()),
  };
}
