import { auth } from '@/lib/firebase';
import type { ContentVersionDomain, ContentVersions } from '@shared/contracts/session.ts';
import { callAction } from '@/services/backend-action';
import { invalidateDomain, queryClient } from '@/lib/query-client';

export type { ContentVersionDomain } from '@shared/contracts/session.ts';

/**
 * The version of each domain the cached answers were read at. It is kept in
 * the query cache itself, so it is saved and restored with those answers and
 * can never claim a newer version than the answers beside it.
 */
const VERSIONS_KEY = ['content-versions'] as const;
const pendingChecks = new Map<string, Promise<ContentVersionDomain[]>>();

function cachedVersions() {
  return queryClient.getQueryData<ContentVersions>(VERSIONS_KEY);
}

/** Marks every domain whose version moved since the cached answers were read stale. */
export function applyContentVersionsSnapshot(versions: ContentVersions) {
  const previous = cachedVersions();
  const domains = (Object.keys(versions) as ContentVersionDomain[])
    .filter((domain) => previous?.[domain] !== versions[domain]);
  domains.forEach((domain) => void invalidateDomain(domain));
  queryClient.setQueryData(VERSIONS_KEY, { ...versions });
  return domains;
}

export async function ensureContentVersionsFresh() {
  const uid = auth?.currentUser?.uid ?? '';
  if (!uid || (typeof navigator !== 'undefined' && !navigator.onLine)) return [];

  const existing = pendingChecks.get(uid);
  if (existing) return await existing;

  const pending = (async () => {
    const result = await callAction('getContentVersions', {});
    if (auth?.currentUser?.uid !== uid) return [];
    return applyContentVersionsSnapshot(result.versions);
  })().finally(() => {
    pendingChecks.delete(uid);
  });
  pendingChecks.set(uid, pending);
  return await pending;
}

export function registerContentVersion(domain: ContentVersionDomain, version: number) {
  if (!Number.isFinite(version)) return;
  const previous = cachedVersions() ?? { announcements: 1, facilities: 1, issues: 1 };
  if (version <= previous[domain]) return;
  queryClient.setQueryData(VERSIONS_KEY, { ...previous, [domain]: version });
}

export function hasContentVersionGap(domain: ContentVersionDomain, version: number) {
  if (!Number.isFinite(version) || version <= 0) return false;
  return version > (cachedVersions()?.[domain] ?? 1) + 1;
}
