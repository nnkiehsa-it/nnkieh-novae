import { getOperationPolicy } from './operation-policies';

export function advanceFeedPageCount(currentPageCount: number, loadingNextPage: boolean) {
  return loadingNextPage
    ? Math.min(getOperationPolicy('feedPages'), Math.max(1, currentPageCount) + 1)
    : 1;
}

export function canLoadAnotherFeedPage(pageCount: number, backendHasMore: boolean) {
  return backendHasMore && pageCount < getOperationPolicy('feedPages');
}

export function limitRetainedFeedItems<T>(items: T[], pageSize: number) {
  return items.slice(0, pageSize * getOperationPolicy('feedPages'));
}
