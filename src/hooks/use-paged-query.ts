"use client";

import { useInfiniteQuery, type InfiniteData, type QueryKey } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { canContinuePage, mergePageById } from "@/lib/pagination";
import { canLoadAnotherFeedPage } from "@/lib/feed-page-limit";

interface Page<C> {
  cursor: C | null;
  hasMore: boolean;
}

/**
 * A list read a page at a time. The pages live in the query cache, so leaving a
 * screen and coming back shows what was there, and an invalidation of its
 * domain reads it again from the first page.
 */
export function usePagedQuery<C, P extends Page<C>, I extends { id: string }>({
  enabled = true,
  items,
  queryKey,
  read,
}: {
  enabled?: boolean;
  items: (page: P) => I[];
  queryKey: QueryKey;
  read: (cursor: C | null, signal: AbortSignal) => Promise<P>;
}) {
  const { t } = useI18n();
  const query = useInfiniteQuery<P, Error, InfiniteData<P, C | null>, QueryKey, C | null>({
    enabled,
    queryKey,
    initialPageParam: null as C | null,
    // The context's page type is a conditional the generic `C` leaves unresolved.
    queryFn: ({ pageParam, signal }) => read(pageParam as C | null, signal),
    getNextPageParam: (last, _pages, lastCursor) =>
      canContinuePage(lastCursor, last.cursor, last.hasMore) ? last.cursor : undefined,
  });
  const pages = query.data?.pages ?? [];
  const hasMore = canLoadAnotherFeedPage(pages.length, query.hasNextPage);
  return {
    error: query.error ? query.error.message || t("ui.common.loadFailed") : "",
    firstPage: pages[0] as P | undefined,
    hasMore,
    items: pages.reduce<I[]>((merged, page) => mergePageById(merged, items(page)), []),
    loading: query.isLoading,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => {
      if (hasMore && !query.isFetching) void query.fetchNextPage({ cancelRefetch: false });
    },
    reload: () => {
      void query.refetch();
    },
  };
}
