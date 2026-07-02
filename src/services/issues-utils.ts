import type { IssueCategory } from '@/types';
import { ISSUES_COLLECTION } from './issues-constants';

export function getCollectionName(_category: IssueCategory): string {
  return ISSUES_COLLECTION;
}

export function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function sortComments<T extends { is_admin_comment: boolean; created_at: Date | null }>(comments: T[]) {
  return [...comments].sort((left, right) => {
    if (left.is_admin_comment !== right.is_admin_comment) {
      return left.is_admin_comment ? -1 : 1;
    }
    const leftTime = left.created_at?.getTime() ?? 0;
    const rightTime = right.created_at?.getTime() ?? 0;
    return leftTime - rightTime;
  });
}

export function sortIssues<T extends { created_at: Date | null }>(issues: T[]) {
  return [...issues].sort((left, right) => {
    const leftTime = left.created_at?.getTime() ?? 0;
    const rightTime = right.created_at?.getTime() ?? 0;
    return rightTime - leftTime;
  });
}

export function chunkList<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
