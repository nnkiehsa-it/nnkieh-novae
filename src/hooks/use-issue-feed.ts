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
import { toggleSupport } from "@/services/issues";
import type {
  IssueCursor,
  IssueRecord,
  IssueSortOption,
  IssueStatusBucket,
} from "@/types";

interface IssueFeed {
  cursor: IssueCursor | null;
  hasMore: boolean;
  issues: IssueRecord[];
}

export function useIssueFeed() {
  const params = useParams<{ filter: string }>();
  const router = useRouter();
  const session = useSession();
  const categories = useCategories();
  const { t } = useI18n();
  const filter = decodeURIComponent(params.filter);
  const validFilter =
    filter === "my-proposals" || Boolean(findIssueCategory(filter));
  const [bucket, setBucket] = React.useState<IssueStatusBucket>("active");
  const [sort, setSort] = React.useState<IssueSortOption>("latest");
  const [query, setQuery] = React.useState("");
  const [committedQuery, setCommittedQuery] = React.useState("");
  const [feed, setFeed] = React.useState<IssueFeed>({
    cursor: null,
    hasMore: false,
    issues: [],
  });
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState("");
  const [supportingId, setSupportingId] = React.useState<string | null>(null);
  const [supportBurstById, setSupportBurstById] = React.useState<Record<string, number>>({});
  const supportedIssueIdsRef = React.useRef(session.mySupportedIssueIds);

  React.useEffect(() => {
    supportedIssueIdsRef.current = session.mySupportedIssueIds;
  }, [session.mySupportedIssueIds]);

  async function support(issueId: string) {
    if (supportingId) return;
    setSupportingId(issueId);
    try {
      const result = await toggleSupport(issueId);
      setFeed((current) => ({
        ...current,
        issues: current.issues.map((issue) =>
          issue.id === issueId
            ? { ...issue, currentUserSupported: result.supported, support_count: result.support_count }
            : issue,
        ),
      }));
      session.setSupportedIssue(issueId, result.supported);
      setSupportBurstById((current) => ({
        ...current,
        [issueId]: (current[issueId] ?? 0) + 1,
      }));
    } finally {
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
    async (cursor: IssueCursor | null = null) => {
      if (!session.user || !validFilter) return;
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
        setFeed((current) => ({
          ...result,
          issues: cursor ? [...current.issues, ...result.issues] : result.issues,
        }));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t("ui.common.loadFailed"));
      } finally {
        setLoading(false);
        setLoadingMore(false);
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
    ],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  return {
    bucket,
    committedQuery,
    error,
    feed,
    filter,
    load,
    loading,
    loadingMore,
    query,
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
