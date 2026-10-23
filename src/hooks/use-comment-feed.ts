import { useState } from "react";
import type { QueryKey } from "@tanstack/react-query";
import { usePagedQuery } from "@/hooks/use-paged-query";
import type { Comment, CommentCursor, CommentSortOption } from "@/types";

interface CommentPage {
  comments: Comment[];
  cursor: CommentCursor | null;
  hasMore: boolean;
}

/** A discussion's comments, a page at a time, for a proposal or an announcement alike. */
export function useCommentFeed({
  enabled,
  queryKey,
  read,
}: {
  enabled: boolean;
  queryKey: (sort: CommentSortOption) => QueryKey;
  read: (cursor: CommentCursor | null, sort: CommentSortOption, signal: AbortSignal) => Promise<CommentPage>;
}) {
  const [sort, setSort] = useState<CommentSortOption>("newest");
  const feed = usePagedQuery({
    enabled,
    queryKey: queryKey(sort),
    read: (cursor: CommentCursor | null, signal) => read(cursor, sort, signal),
    items: (page: CommentPage) => page.comments,
  });
  return {
    comments: enabled ? feed.items : [],
    error: feed.error,
    hasMore: enabled && feed.hasMore,
    loading: feed.loading,
    loadingMore: feed.loadingMore,
    loadMore: feed.loadMore,
    reload: feed.reload,
    setSort,
    sort,
  };
}
