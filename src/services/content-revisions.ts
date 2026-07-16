import { auth } from '@/lib/firebase';
import { invokeBackendAction } from '@/services/backend-action';
import { markContentCachePrefixStale } from '@/services/content-read-cache';

export type ContentRevisionDomain = 'announcements' | 'facilities' | 'issues';
type ContentRevisions = Record<ContentRevisionDomain, number>;

interface StoredContentRevisions {
  checkedAt: number;
  revisions: ContentRevisions;
}

const REVISION_CHECK_INTERVAL_MS = 30 * 60_000;
const STORAGE_KEY_PREFIX = 'novae:content-revisions:';
const DOMAIN_PREFIXES: Record<ContentRevisionDomain, readonly string[]> = {
  announcements: ['announcement-list-page|', 'announcement-detail|', 'announcement-comments-page|'],
  facilities: ['facility-list-page|', 'facility-detail|'],
  issues: ['issue-list-page|', 'issue-search|', 'user-issue-list-page|', 'issue-detail|', 'issue-comments-page|'],
};

const listeners = new Map<ContentRevisionDomain, Set<() => void | Promise<void>>>();
const pendingChecks = new Map<string, Promise<ContentRevisionDomain[]>>();
const pendingNotifications = new Set<string>();

function storageKey(uid: string) {
  return `${STORAGE_KEY_PREFIX}${uid}`;
}

function readStoredRevisions(uid: string): StoredContentRevisions | null {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredContentRevisions>;
    const revisions = value.revisions;
    if (
      typeof value.checkedAt !== 'number'
      || !revisions
      || typeof revisions.announcements !== 'number'
      || typeof revisions.facilities !== 'number'
      || typeof revisions.issues !== 'number'
    ) return null;
    return { checkedAt: value.checkedAt, revisions };
  } catch {
    return null;
  }
}

function writeStoredRevisions(uid: string, value: StoredContentRevisions) {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(value));
  } catch {
    // Revision persistence is an optimization; the content cache remains usable.
  }
}

function invalidateDomain(domain: ContentRevisionDomain) {
  DOMAIN_PREFIXES[domain].forEach(markContentCachePrefixStale);
}

function notifyChangedDomains(domains: ContentRevisionDomain[]) {
  domains.forEach((domain) => {
    listeners.get(domain)?.forEach((listener) => void listener());
  });
}

export async function ensureContentRevisionsFresh(options: { notify?: boolean } = {}) {
  const uid = auth?.currentUser?.uid ?? '';
  if (!uid || (typeof navigator !== 'undefined' && !navigator.onLine)) return [];

  const stored = readStoredRevisions(uid);
  if (stored && Date.now() - stored.checkedAt < REVISION_CHECK_INTERVAL_MS) return [];
  if (options.notify) pendingNotifications.add(uid);

  const existing = pendingChecks.get(uid);
  if (existing) return await existing;

  const pending = (async () => {
    const fn = invokeBackendAction<Record<string, never>, { revisions: ContentRevisions }>('getContentRevisions');
    const result = await fn({});
    if (auth?.currentUser?.uid !== uid) return [];

    const previous = readStoredRevisions(uid);
    const domains = (Object.keys(result.revisions) as ContentRevisionDomain[]).filter((domain) =>
      !previous || previous.revisions[domain] !== result.revisions[domain]
    );
    domains.forEach(invalidateDomain);
    writeStoredRevisions(uid, { checkedAt: Date.now(), revisions: result.revisions });
    if (pendingNotifications.has(uid)) notifyChangedDomains(domains);
    return domains;
  })().finally(() => {
    pendingChecks.delete(uid);
    pendingNotifications.delete(uid);
  });
  pendingChecks.set(uid, pending);
  return await pending;
}

export async function prepareContentRevisionRead() {
  try {
    await ensureContentRevisionsFresh();
  } catch {
    // Cached content remains available when the lightweight revision check fails.
  }
}

export function subscribeContentRevisionChanges(domain: ContentRevisionDomain, listener: () => void | Promise<void>) {
  const domainListeners = listeners.get(domain) ?? new Set();
  domainListeners.add(listener);
  listeners.set(domain, domainListeners);
  return () => {
    domainListeners.delete(listener);
    if (domainListeners.size === 0) listeners.delete(domain);
  };
}

export function resetContentRevisionState() {
  pendingNotifications.clear();
}
