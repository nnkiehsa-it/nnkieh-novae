import { getOperationPolicy } from './operation-policies';

export function canLoadAnotherFeedPage(pageCount: number, backendHasMore: boolean) {
  return backendHasMore && pageCount < getOperationPolicy('feedPages');
}

export function limitRetainedFeedItems<T>(items: T[], pageSize: number) {
  return items.slice(0, pageSize * getOperationPolicy('feedPages'));
}
