export const MAX_RETAINED_FEED_PAGES = 5;

export function advanceFeedPageCount(currentPageCount: number, loadingNextPage: boolean) {
  return loadingNextPage
    ? Math.min(MAX_RETAINED_FEED_PAGES, Math.max(1, currentPageCount) + 1)
    : 1;
}

export function canLoadAnotherFeedPage(pageCount: number, backendHasMore: boolean) {
  return backendHasMore && pageCount < MAX_RETAINED_FEED_PAGES;
}

export function limitRetainedFeedItems<T>(items: T[], pageSize: number) {
  return items.slice(0, pageSize * MAX_RETAINED_FEED_PAGES);
}
