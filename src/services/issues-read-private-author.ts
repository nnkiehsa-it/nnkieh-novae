import type { IssueRecord, PrivateAuthorRecord } from '@/types';
import { issueStoresAuthorPrivately } from '@/constants/categories';
import { READ_REQUEST_TIMEOUT_MS } from '@/lib/request';
import { invokeBackendAction } from '@/services/backend-action';
import { normalizeDate, toReadableBackendError } from './issues-core';

function normalizePrivateAuthorRecord(issueId: string, data: Record<string, unknown>): PrivateAuthorRecord {
  return {
    issue_id: String(data.issue_id ?? issueId),
    author_uid: String(data.author_uid ?? ''),
    author_name: String(data.author_name ?? '未知'),
    author_photo_url: (data.author_photo_url as string | null | undefined) ?? null,
    created_at: normalizeDate(data.created_at),
  };
}

function withPrivateAuthor(issue: IssueRecord, author: PrivateAuthorRecord): IssueRecord {
  return {
    ...issue,
    author_uid: author.author_uid,
    author_name: author.author_name,
    author_photo_url: author.author_photo_url,
  };
}

export async function fetchPrivateAuthorInfo(issueId: string): Promise<PrivateAuthorRecord> {
  try {
    const fn = invokeBackendAction<{ issueId: string }, { author: Record<string, unknown> }>('getPrivateIssueAuthor', {
      timeoutMs: READ_REQUEST_TIMEOUT_MS,
    });
    const result = await fn({ issueId });
    return normalizePrivateAuthorRecord(issueId, result.data.author);
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

async function fetchPrivateAuthorInfoMap(issueIds: string[]): Promise<Map<string, PrivateAuthorRecord>> {
  const uniqueIssueIds = Array.from(new Set(issueIds.filter(Boolean)));
  const authorMap = new Map<string, PrivateAuthorRecord>();
  if (uniqueIssueIds.length === 0) {
    return authorMap;
  }

  const fn = invokeBackendAction<{ issueIds: string[] }, { authors: Record<string, Record<string, unknown>> }>(
    'batchGetPrivateIssueAuthors',
    { timeoutMs: READ_REQUEST_TIMEOUT_MS },
  );
  const result = await fn({ issueIds: uniqueIssueIds });
  Object.entries(result.data.authors).forEach(([issueId, author]) => {
    authorMap.set(issueId, normalizePrivateAuthorRecord(issueId, author));
  });
  return authorMap;
}

export async function attachPrivateAuthorInfo(issues: IssueRecord[], enabled: boolean): Promise<IssueRecord[]> {
  if (!enabled) return issues;

  const publicIssueIds = issues
    .filter((issue) => issueStoresAuthorPrivately(issue.category) && !issue.author_uid)
    .map((issue) => issue.id);
  if (publicIssueIds.length === 0) return issues;

  const authorMap = await fetchPrivateAuthorInfoMap(publicIssueIds);
  return issues.map((issue) => {
    const author = authorMap.get(issue.id);
    return author ? withPrivateAuthor(issue, author) : issue;
  });
}

export function attachKnownPrivateAuthors(
  issues: IssueRecord[],
  privateAuthors: PrivateAuthorRecord[],
): IssueRecord[] {
  const authorMap = new Map(privateAuthors.map((author) => [author.issue_id, author]));
  return issues.map((issue) => {
    const author = authorMap.get(issue.id);
    return author ? withPrivateAuthor(issue, author) : issue;
  });
}
