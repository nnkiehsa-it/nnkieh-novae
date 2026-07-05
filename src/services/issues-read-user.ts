import { READ_REQUEST_TIMEOUT_MS } from '@/lib/request';
import { invokeBackendAction } from '@/services/backend-action';
import type { IssueCursor, IssueSortOption } from '@/types';
import { normalizeIssueCursor, normalizeIssueRecord, toReadableBackendError, withSupportState } from './issues-core';

export async function fetchUserIssues(
  uid: string,
  cursor: IssueCursor | null,
  options?: {
    pageSize?: number;
    sort?: IssueSortOption;
    supportedIssueIds?: Set<string>;
  },
) {
  try {
    const fn = invokeBackendAction<
      { cursor: IssueCursor | null; pageSize: number; sort: IssueSortOption; uid: string },
      { cursor: IssueCursor | null; hasMore: boolean; issues: Record<string, unknown>[] }
    >('listUserIssues', {
      timeoutMs: READ_REQUEST_TIMEOUT_MS,
    });
    const result = await fn({ cursor, pageSize: options?.pageSize ?? 20, sort: options?.sort ?? 'latest', uid });
    const issues = result.data.issues.map((issue) => normalizeIssueRecord(String(issue.id ?? ''), issue));
    return {
      cursor: normalizeIssueCursor(result.data.cursor),
      hasMore: result.data.hasMore,
      issues: withSupportState(issues, options?.supportedIssueIds),
    };
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
