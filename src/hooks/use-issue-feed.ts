"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import {
  findIssueCategory,
  getDefaultIssueCategoryId,
  useCategories,
} from "@/hooks/use-categories";
import { useSession } from "@/hooks/use-session";
import {
  fetchIssuesForTitleSearch,
  fetchIssuesPageByStatus,
  fetchUserIssues,
} from "@/services/issues";
import { removeSupport, toggleSupport } from "@/services/issues";
import type {
  IssueCursor,
  IssueSummary,
  IssueSortOption,
  IssueStatusBucket,
} from "@/types";
import {
  beginContentEntityRead,
  getContentEntity,
  mergeContentEntityRead,
  patchContentEntity,
} from "@/lib/content-entity-store";
import { canContinuePage, mergePageById } from "@/lib/pagination";
import { toIssueStatusCounts, type IssueStatusCounts } from "@/constants/statuses";
import { usePagedRequestGuard } from "@/hooks/use-paged-request-guard";
import { useFeedUrlState } from "@/hooks/use-feed-url-state";
import { readIssueFeedFilters } from "@/lib/feed-url-state";
import { useContentEntityDomainVersion } from "@/hooks/use-content-entity";
import { useContentInvalidationRefresh } from "@/hooks/use-content-invalidation-refresh";
import { getViewMemory, setViewMemory } from "@/lib/view-memory-cache";
import { useColdDataReveal } from "@/hooks/use-cold-data-reveal";
import { useOptimisticReaction } from "@/hooks/use-optimistic-reaction";
import { advanceFeedPageCount, canLoadAnotherFeedPage } from "@/lib/feed-page-limit";
import {
  getSupportedIssueIdsSnapshot,
  rememberSupportedIssue,
} from "@/lib/supported-issue-memory";

const ISSUE_LIST_CACHE_PREFIXES = [
  "issue-list-page|",
  "issue-search|",
  "user-issue-list-page|",
] as const;

interface IssueFeed {
  cursor: IssueCursor | null;
  hasMore: boolean;
  issues: IssueSummary[];
  pageCount: number;
  statusCounts: IssueStatusCounts;
}

interface IssueFeedViewMemory {
  bucket: IssueStatusBucket;
  committedQuery: string;
  feed: IssueFeed;
  query: string;
  sort: IssueSortOption;
}

export function useIssueFeed(selectedFilter?: string) {
  const params = useParams<{ filter: string }>();
  const router = useRouter();
  const session = useSession();
  const categories = useCategories();
  const { t } = useI18n();
  const filter = selectedFilter ?? decodeURIComponent(params.filter);
  const { params: searchParams, committedQuery, query, setCommittedQuery, setQuery, updateParams } = useFeedUrlState();
  const { bucket, sort } = readIssueFeedFilters(searchParams);
  const remembered = getViewMemory<IssueFeedViewMemory>(
    session.user?.uid,
    `issue-feed|${filter}`,
  );
  const viewMemory = remembered?.bucket === bucket && remembered.sort === sort
    && remembered.committedQuery === committedQuery ? remembered : null;
  const [coldRead] = React.useState(() => !viewMemory);
  const [warmRead] = React.useState(() => Boolean(viewMemory));
  const readSucceeded = React.useRef(false);
  const validFilter =
    filter === "my-proposals" || Boolean(findIssueCategory(filter));
  const [feed, setFeed] = React.useState<IssueFeed>({
    cursor: viewMemory?.feed.cursor ?? null,
    hasMore: viewMemory?.feed.hasMore ?? false,
    issues: viewMemory?.feed.issues ?? [],
    pageCount: viewMemory?.feed.pageCount ?? (viewMemory?.feed.issues.length ? 1 : 0),
    statusCounts: viewMemory?.feed.statusCounts ?? toIssueStatusCounts({}),
  });
  const [loading, setLoading] = React.useState(!viewMemory);
  const revealFields = useColdDataReveal(coldRead, loading);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState("");
  const reaction = useOptimisticReaction(session.user?.uid, "issue");
  const supportedIssueIdsRef = React.useRef(getSupportedIssueIdsSnapshot());
  const requestGuard = usePagedRequestGuard();
  const entityVersion = useContentEntityDomainVersion(session.user?.uid, "issue");
  const queryKey = [
    session.user?.uid ?? "",
    filter,
    bucket,
    sort,
    committedQuery,
    session.isAdmin ? "admin" : "user",
  ].join("|");

  function setSupportedIssue(issueId: string, supported: boolean) {
    rememberSupportedIssue(issueId, supported);
    const next = new Set(supportedIssueIdsRef.current);
    if (supported) next.add(issueId);
    else next.delete(issueId);
    supportedIssueIdsRef.current = next;
  }

  async function support(issueId: string) {
    const issue =
      getContentEntity<IssueSummary>(session.user?.uid, "issue", issueId) ??
      feed.issues.find((item) => item.id === issueId);
    if (!issue || issue.isOwnIssue) return;
    return reaction.run({
      id: issueId,
      previous: { active: issue.currentUserSupported === true, count: issue.support_count },
      apply: ({ active, count }, pending) => {
        patchContentEntity<IssueSummary>(session.user?.uid, "issue", issueId, { currentUserSupported: active, support_count: count }, { pending });
        setSupportedIssue(issueId, active);
      },
      request: async (active) => {
        const result = active ? await toggleSupport(issueId) : await removeSupport(issueId);
        return { active: result.supported, count: result.support_count };
      },
      errorMessage: t("ui.issue.supportFailed"),
    });
  }

  React.useEffect(() => {
    if (categories.loaded && !validFilter) {
      router.replace(
        `/issues/${encodeURIComponent(getDefaultIssueCategoryId() || "my-proposals")}`,
      );
    }
  }, [categories.loaded, router, validFilter]);

  const load = React.useCallback(
    async (cursor: IssueCursor | null = null, restart = false) => {
      if (!session.user || !validFilter) return;
      if (restart) requestGuard.restart(queryKey);
      const requestToken = requestGuard.begin(queryKey);
      if (!requestToken) return;
      const entityReadRevision = beginContentEntityRead();
      cursor ? setLoadingMore(true) : setLoading(!getViewMemory(session.user.uid, `issue-feed|${filter}`));
      setError("");
      try {
        let result: Omit<IssueFeed, "pageCount" | "statusCounts">;
        // A later page and a title search both leave the counts alone: they describe
        // the whole category, not the rows this request happened to return.
        let statusCounts: IssueStatusCounts | null = null;
        if (filter === "my-proposals") {
          const page = await fetchUserIssues(session.user.uid, cursor, {
            query: committedQuery,
            sort,
            statusBucket: bucket,
            supportedIssueIds: supportedIssueIdsRef.current,
            forceRefresh: !cursor && (warmRead || restart),
          });
          result = page;
          statusCounts = page.statusCounts;
        } else if (committedQuery.trim()) {
          result = await fetchIssuesForTitleSearch(
            session.user.uid,
            filter,
            bucket,
            committedQuery,
            {
              cursor,
              isAdmin: session.isAdmin,
              sort,
              supportedIssueIds: supportedIssueIdsRef.current,
              forceRefresh: !cursor && (warmRead || restart),
            },
          );
        } else {
          const page = await fetchIssuesPageByStatus(
            session.user.uid,
            filter,
            bucket,
            cursor,
            {
              isAdmin: session.isAdmin,
              sort,
              supportedIssueIds: supportedIssueIdsRef.current,
              forceRefresh: !cursor && (warmRead || restart),
            },
          );
          result = page;
          statusCounts = page.statusCounts;
        }
        if (!requestGuard.isCurrent(requestToken)) return;
        readSucceeded.current = true;
        const issues = result.issues.map((issue) =>
          mergeContentEntityRead(
            session.user?.uid,
            "issue",
            {
            ...issue,
              currentUserSupported:
                issue.isOwnIssue || issue.currentUserSupported === true,
            },
            entityReadRevision,
            "summary",
          ),
        );
        setFeed((current) => {
          const pageCount = advanceFeedPageCount(current.pageCount, Boolean(cursor));
          return {
            ...result,
            hasMore: canLoadAnotherFeedPage(
              pageCount,
              canContinuePage(cursor, result.cursor, result.hasMore),
            ),
            issues: cursor ? mergePageById(current.issues, issues) : issues,
            pageCount,
            statusCounts: cursor ? current.statusCounts : statusCounts ?? current.statusCounts,
          };
        });
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
    [
      bucket,
      committedQuery,
      filter,
      session.isAdmin,
      session.user,
      sort,
      t,
      validFilter,
      queryKey,
      requestGuard,
      warmRead,
    ],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (loading || !readSucceeded.current) return;
    setViewMemory<IssueFeedViewMemory>(
      session.user?.uid,
      `issue-feed|${filter}`,
      { bucket, committedQuery, feed, query, sort },
      ISSUE_LIST_CACHE_PREFIXES,
    );
  }, [bucket, committedQuery, feed, filter, loading, query, session.user?.uid, sort]);

  useContentInvalidationRefresh(ISSUE_LIST_CACHE_PREFIXES, () => load(null, true));

  const synchronizedFeed = {
    ...feed,
    issues: feed.issues.map(
      (issue) =>
        getContentEntity<IssueSummary>(
          session.user?.uid,
          "issue",
          issue.id,
        ) ?? issue,
    ).filter((issue) => !issue.deleting),
  };
  void entityVersion;

  return {
    bucket,
    committedQuery,
    error,
    feed: synchronizedFeed,
    filter,
    load,
    loading,
    loadingMore,
    query,
    revealFields,
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
