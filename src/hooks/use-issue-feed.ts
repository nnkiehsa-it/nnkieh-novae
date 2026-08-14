"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { toggleSupport } from "@/services/issues";
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
import { usePagedRequestGuard } from "@/hooks/use-paged-request-guard";
import { useContentEntityDomainVersion } from "@/hooks/use-content-entity";
import { useContentInvalidationRefresh } from "@/hooks/use-content-invalidation-refresh";
import { getViewMemory, setViewMemory } from "@/lib/view-memory-cache";
import { waitForMinimumSkeletonDuration } from "@/lib/loading-timing";
import { useColdDataReveal } from "@/hooks/use-cold-data-reveal";
import { toggleReactionState } from "@/lib/reaction-state";

const ISSUE_LIST_CACHE_PREFIXES = [
  "issue-list-page|",
  "issue-search|",
  "user-issue-list-page|",
] as const;

interface IssueFeed {
  cursor: IssueCursor | null;
  hasMore: boolean;
  issues: IssueSummary[];
}

interface IssueFeedViewMemory {
  bucket: IssueStatusBucket;
  committedQuery: string;
  feed: IssueFeed;
  query: string;
  sort: IssueSortOption;
}

export function useIssueFeed() {
  const params = useParams<{ filter: string }>();
  const router = useRouter();
  const session = useSession();
  const categories = useCategories();
  const { t } = useI18n();
  const filter = decodeURIComponent(params.filter);
  const viewMemory = getViewMemory<IssueFeedViewMemory>(
    session.user?.uid,
    `issue-feed|${filter}`,
  );
  const [coldRead] = React.useState(() => !viewMemory);
  const validFilter =
    filter === "my-proposals" || Boolean(findIssueCategory(filter));
  const [bucket, setBucket] = React.useState<IssueStatusBucket>(viewMemory?.bucket ?? "active");
  const [sort, setSort] = React.useState<IssueSortOption>(viewMemory?.sort ?? "latest");
  const [query, setQuery] = React.useState(viewMemory?.query ?? "");
  const [committedQuery, setCommittedQuery] = React.useState(viewMemory?.committedQuery ?? "");
  const [feed, setFeed] = React.useState<IssueFeed>({
    cursor: viewMemory?.feed.cursor ?? null,
    hasMore: viewMemory?.feed.hasMore ?? false,
    issues: viewMemory?.feed.issues ?? [],
  });
  const [loading, setLoading] = React.useState(!viewMemory);
  const revealFields = useColdDataReveal(coldRead, loading);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState("");
  const [supportingId, setSupportingId] = React.useState<string | null>(null);
  const supportingRef = React.useRef<string | null>(null);
  const [supportBurstById, setSupportBurstById] = React.useState<Record<string, number>>({});
  const supportedIssueIdsRef = React.useRef(session.mySupportedIssueIds);
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

  React.useEffect(() => {
    supportedIssueIdsRef.current = session.mySupportedIssueIds;
  }, [session.mySupportedIssueIds]);

  async function support(issueId: string) {
    if (supportingRef.current) return;
    const issue =
      getContentEntity<IssueSummary>(session.user?.uid, "issue", issueId) ??
      feed.issues.find((item) => item.id === issueId);
    if (!issue || issue.isOwnIssue) return;
    const previous = {
      active: issue.currentUserSupported === true,
      count: issue.support_count,
    };
    const optimistic = toggleReactionState(previous);
    supportingRef.current = issueId;
    setSupportingId(issueId);
    patchContentEntity<IssueSummary>(session.user?.uid, "issue", issueId, {
      currentUserSupported: optimistic.active,
      support_count: optimistic.count,
    });
    session.setSupportedIssue(issueId, optimistic.active);
    if (optimistic.active) {
      setSupportBurstById((current) => ({
        ...current,
        [issueId]: (current[issueId] ?? 0) + 1,
      }));
    }
    try {
      const result = await toggleSupport(issueId);
      patchContentEntity<IssueSummary>(session.user?.uid, "issue", issueId, {
        currentUserSupported: result.supported,
        support_count: result.support_count,
      });
      session.setSupportedIssue(issueId, result.supported);
    } catch {
      patchContentEntity<IssueSummary>(session.user?.uid, "issue", issueId, {
        currentUserSupported: previous.active,
        support_count: previous.count,
      });
      session.setSupportedIssue(issueId, previous.active);
      toast.error(t("ui.issue.supportFailed"));
    } finally {
      supportingRef.current = null;
      setSupportingId(null);
    }
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
      const skeletonStartedAt = !cursor && coldRead ? Date.now() : 0;
      cursor ? setLoadingMore(true) : setLoading(true);
      setError("");
      try {
        let result: IssueFeed;
        if (filter === "my-proposals") {
          result = await fetchUserIssues(session.user.uid, cursor, {
            sort,
            statusBucket: bucket,
            supportedIssueIds: supportedIssueIdsRef.current,
          });
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
            },
          );
        } else {
          result = await fetchIssuesPageByStatus(
            session.user.uid,
            filter,
            bucket,
            cursor,
            {
              isAdmin: session.isAdmin,
              sort,
              supportedIssueIds: supportedIssueIdsRef.current,
            },
          );
        }
        if (!requestGuard.isCurrent(requestToken)) return;
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
        setFeed((current) => ({
          ...result,
          hasMore: canContinuePage(cursor, result.cursor, result.hasMore),
          issues: cursor ? mergePageById(current.issues, issues) : issues,
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
      committedQuery,
      filter,
      session.isAdmin,
      session.user,
      sort,
      t,
      validFilter,
      queryKey,
      requestGuard,
      coldRead,
    ],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (loading) return;
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
    setBucket,
    setCommittedQuery,
    setQuery,
    setSort,
    sort,
    support,
    supportBurstById,
    supportingId,
  };
}
