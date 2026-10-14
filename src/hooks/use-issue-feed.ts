"use client";

import { useI18n } from "@/i18n";
import { findIssueCategory, useCategories } from "@/hooks/use-categories";
import { useSession } from "@/hooks/use-session";
import { issueKeys, listIssues, listUserIssues, searchIssues, setSupport } from "@/services/issues";
import type { IssueCursor, IssueSortOption, IssueStatusBucket, IssueSummary } from "@/types";
import type { InfiniteData } from "@tanstack/react-query";
import { toIssueStatusCounts, type IssueStatusCounts } from "@/constants/statuses";
import { useFeedUrlState } from "@/hooks/use-feed-url-state";
import { readIssueFeedFilters } from "@/lib/feed-url-state";
import { patchEntity, queryClient } from "@/lib/query-client";
import { useOptimisticReaction } from "@/hooks/use-optimistic-reaction";
import { usePagedQuery } from "@/hooks/use-paged-query";

/** One issue category's feed; `filter` is a valid category id or "my-proposals". */
export function useIssueFeed(filter: string) {
  const session = useSession();
  useCategories();
  const { t } = useI18n();
  const { params: searchParams, committedQuery, query, setCommittedQuery, setQuery, updateParams } = useFeedUrlState();
  const { bucket, sort } = readIssueFeedFilters(searchParams);
  const validFilter = filter === "my-proposals" || Boolean(findIssueCategory(filter));
  const reaction = useOptimisticReaction();
  const searching = committedQuery.trim() !== "";

  const feed = usePagedQuery({
    enabled: Boolean(session.user) && validFilter,
    queryKey: issueKeys.list({ filter, bucket, sort, query: committedQuery }),
    read: (cursor: IssueCursor | null, signal) => {
      const paging = { cursor, sort, statusBucket: bucket };
      if (filter === "my-proposals") return listUserIssues({ ...paging, query: committedQuery }, signal);
      if (searching) return searchIssues({ ...paging, category: filter, query: committedQuery }, signal);
      return listIssues({ ...paging, category: filter }, signal);
    },
    items: (page) => page.issues,
  });
  // A title search leaves the counts alone: they describe the whole category.
  const unsearched = searching
    ? queryClient.getQueryData<InfiniteData<{ statusCounts?: IssueStatusCounts | null }>>(
      issueKeys.list({ filter, bucket, sort, query: "" }),
    )?.pages[0]
    : undefined;
  const firstPage = feed.firstPage as { statusCounts?: IssueStatusCounts | null } | undefined;
  const statusCounts = firstPage?.statusCounts ?? unsearched?.statusCounts ?? toIssueStatusCounts({});

  async function support(issueId: string) {
    const issue = feed.items.find((item) => item.id === issueId);
    if (!issue || issue.isOwnIssue) return;
    return reaction.run({
      id: issueId,
      previous: { active: issue.currentUserSupported, count: issue.supportCount },
      apply: ({ active, count }) =>
        patchEntity<IssueSummary>("issues", issueId, { currentUserSupported: active, supportCount: count }),
      request: async (active) => {
        const result = await setSupport(issueId, active);
        return { active: result.supported, count: result.supportCount };
      },
      errorMessage: t("ui.issue.supportFailed"),
    });
  }

  return {
    bucket,
    committedQuery,
    error: feed.error,
    feed: { hasMore: feed.hasMore, issues: feed.items, statusCounts },
    filter,
    loading: feed.loading,
    loadingMore: feed.loadingMore,
    loadMore: feed.loadMore,
    query,
    reload: feed.reload,
    setBucket: (value: IssueStatusBucket) => updateParams({ bucket: value === "active" ? null : value }),
    setCommittedQuery,
    setQuery,
    setSort: (value: IssueSortOption) => updateParams({ sort: value === "latest" ? null : value }),
    sort,
    support,
    supportBurstById: reaction.burstById,
    isSupporting: reaction.isBusy,
  };
}
