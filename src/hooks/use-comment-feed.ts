"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { usePagedRequestGuard } from "@/hooks/use-paged-request-guard";
import { canContinuePage } from "@/lib/pagination";
import type { CommentCursor } from "@/services/comment-cursor";
import type { CommentSortOption } from "@/types";

interface CommentPage<T> {
  comments: T[];
  cursor: CommentCursor;
  hasMore: boolean;
}

export interface CommentPageRequest<T> {
  cursor: CommentCursor;
  sort: CommentSortOption;
  forceRefresh: boolean;
  onPage?: (page: CommentPage<T>) => void;
}

export function useCommentFeed<T extends { id: string }>({
  enabled,
  targetKey,
  fetchPage,
}: {
  enabled: boolean;
  targetKey: string;
  fetchPage: (request: CommentPageRequest<T>) => Promise<CommentPage<T>>;
}) {
  const { t } = useI18n();
  const [comments, setComments] = useState<T[]>([]);
  const [sort, setSort] = useState<CommentSortOption>("newest");
  const [cursor, setCursor] = useState<CommentCursor>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const guard = usePagedRequestGuard();
  const queryKey = `${targetKey}|${sort}|${enabled}`;

  const load = useCallback(async (forceRefresh = false) => {
    guard.restart(queryKey);
    setLoadingMore(false);
    setError("");
    if (!enabled) {
      setComments([]);
      setCursor(null);
      setHasMore(false);
      setLoading(false);
      return;
    }
    const token = guard.begin(queryKey)!;
    setLoading(true);
    const apply = (page: CommentPage<T>) => {
      if (!guard.isCurrent(token)) return;
      setComments(page.comments);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    };
    try {
      apply(await fetchPage({ cursor: null, sort, forceRefresh, onPage: apply }));
    } catch (caught) {
      if (guard.isCurrent(token)) setError(caught instanceof Error ? caught.message : t("ui.common.loadFailed"));
    } finally {
      if (guard.finish(token)) setLoading(false);
    }
  }, [enabled, fetchPage, guard, queryKey, sort, t]);

  useEffect(() => {
    void load();
    return () => guard.restart(queryKey);
  }, [guard, load, queryKey]);

  const loadMore = useCallback(async () => {
    if (!enabled || !hasMore || !cursor || loading) return;
    const token = guard.begin(queryKey);
    if (!token) return;
    setLoadingMore(true);
    setError("");
    try {
      const page = await fetchPage({ cursor, sort, forceRefresh: false });
      if (!guard.isCurrent(token)) return;
      setComments((current) => {
        const ids = new Set(current.map((comment) => comment.id));
        return [...current, ...page.comments.filter((comment) => !ids.has(comment.id))];
      });
      setCursor(page.cursor);
      setHasMore(canContinuePage(cursor, page.cursor, page.hasMore));
    } catch (caught) {
      if (guard.isCurrent(token)) setError(caught instanceof Error ? caught.message : t("ui.common.loadFailed"));
    } finally {
      if (guard.finish(token)) setLoadingMore(false);
    }
  }, [cursor, enabled, fetchPage, guard, hasMore, loading, queryKey, sort, t]);

  return { comments, sort, setSort, hasMore, loading, loadingMore, error, load, loadMore };
}
