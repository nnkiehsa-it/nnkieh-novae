import { readRequestTimeoutMs } from '@/lib/request';
import { invokeBackendAction } from '@/services/backend-action';
import { toReadableBackendError } from './issues-core';

export {
  fetchIssuesPageByStatus,
  fetchIssuesForTitleSearch,
} from './issues-read-pages';
export {
  fetchUserIssues,
} from './issues-read-user';
export { fetchComments } from './issues-read-comments';

export interface IssueSupporter {
  uid: string;
  displayName: string;
  photoUrl: string | null;
  isAuthor: boolean;
}

export async function fetchIssueSupporters(issueId: string) {
  try {
    const fn = invokeBackendAction<
      { issueId: string },
      { supporters: IssueSupporter[] }
    >('listIssueSupporters', { timeoutMs: readRequestTimeoutMs });
    return (await fn({ issueId })).supporters;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
