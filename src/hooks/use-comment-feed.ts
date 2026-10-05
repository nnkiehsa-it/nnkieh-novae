"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { getViewMemory, setViewMemory } from "@/lib/view-memory-cache";
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
  const uid = useSession().user?.uid;
  const remembered = enabled ? getViewMemory<CommentPage<T>>(uid, `comment-feed|${targetKey}|newest`) : null;
  const [comments, setComments] = useState<T[]>(remembered?.comments ?? []);
  const [sort, setSort] = useState<CommentSortOption>("newest");
  const [cursor, setCursor] = useState<CommentCursor>(remembered?.cursor ?? null);
  const [hasMore, setHasMore] = useState(remembered?.hasMore ?? false);
  const [loading, setLoading] = useState(enabled && !remembered);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const guard = usePagedRequestGuard();
  const queryKey = `${targetKey}|${sort}|${enabled}`;
  const cacheKey = `comment-feed|${targetKey}|${sort}`;

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
    const cached = getViewMemory<CommentPage<T>>(uid, cacheKey);
    setLoading(!cached);
    const apply = (page: CommentPage<T>, persist = true) => {
      if (!guard.isCurrent(token)) return;
      setComments(page.comments);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
      if (persist) setViewMemory(uid, cacheKey, page, ["issue-comments-page|", "announcement-comments-page|"]);
    };
    if (cached) apply(cached, false);
    try {
      apply(await fetchPage({ cursor: null, sort, forceRefresh: forceRefresh || Boolean(cached), onPage: apply }));
    } catch (caught) {
      if (guard.isCurrent(token)) setError(caught instanceof Error ? caught.message : t("ui.common.loadFailed"));
    } finally {
      if (guard.finish(token)) setLoading(false);
    }
  }, [enabled, fetchPage, guard, queryKey, sort, t, uid, cacheKey]);

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
