import { auth } from '@/lib/firebase';
import { invokeBackendAction } from '@/services/backend-action';
import { markContentCachePrefixStale } from '@/services/content-read-cache';
import { readLocalStorage, writeLocalStorage } from '@/lib/browser-storage';

export type ContentVersionDomain = 'announcements' | 'facilities' | 'issues';
export type ContentVersions = Record<ContentVersionDomain, number>;

interface StoredContentVersions {
  versions: ContentVersions;
}

const STORAGE_KEY_PREFIX = 'novae:content-versions:';
const DOMAIN_PREFIXES: Record<ContentVersionDomain, readonly string[]> = {
  announcements: ['announcement-list-page|', 'announcement-detail|', 'announcement-comments-page|'],
  facilities: ['facility-list-page|', 'facility-detail|'],
  issues: ['issue-list-page|', 'issue-search|', 'user-issue-list-page|', 'issue-detail|', 'issue-comments-page|'],
};

const listeners = new Map<ContentVersionDomain, Set<() => void | Promise<void>>>();
const pendingChecks = new Map<string, Promise<ContentVersionDomain[]>>();

function storageKey(uid: string) {
  return `${STORAGE_KEY_PREFIX}${uid}`;
}

function readStoredVersions(uid: string): StoredContentVersions | null {
  try {
    const raw = readLocalStorage(storageKey(uid));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredContentVersions>;
    const versions = value.versions;
    if (
      !versions
      || typeof versions.announcements !== 'number'
      || typeof versions.facilities !== 'number'
      || typeof versions.issues !== 'number'
    ) return null;
    return { versions };
  } catch {
    return null;
  }
}

function writeStoredVersions(uid: string, value: StoredContentVersions) {
  writeLocalStorage(storageKey(uid), JSON.stringify(value));
}

function invalidateDomain(domain: ContentVersionDomain) {
  DOMAIN_PREFIXES[domain].forEach(markContentCachePrefixStale);
}

function notifyChangedDomains(domains: ContentVersionDomain[]) {
  domains.forEach((domain) => {
    listeners.get(domain)?.forEach((listener) => void listener());
  });
}

export function applyContentVersionsSnapshot(
  versions: ContentVersions,
  options: { notify?: boolean } = {},
) {
  const uid = auth?.currentUser?.uid ?? '';
  if (!uid) return [] as ContentVersionDomain[];
  const previous = readStoredVersions(uid);
  const nextVersions = { ...(previous?.versions ?? { announcements: 1, facilities: 1, issues: 1 }) };
  const domains = (Object.keys(versions) as ContentVersionDomain[]).filter((domain) => {
    const next = Math.max(nextVersions[domain], versions[domain]);
    const changed = next > nextVersions[domain];
    nextVersions[domain] = next;
    return changed;
  });
  domains.forEach(invalidateDomain);
  writeStoredVersions(uid, { versions: nextVersions });
  if (options.notify) notifyChangedDomains(domains);
  return domains;
}

export async function ensureContentVersionsFresh(options: { notify?: boolean } = {}) {
  const uid = auth?.currentUser?.uid ?? '';
  if (!uid || (typeof navigator !== 'undefined' && !navigator.onLine)) return [];

  const existing = pendingChecks.get(uid);
  if (existing) return await existing;

  const pending = (async () => {
    const fn = invokeBackendAction<Record<string, never>, { versions: ContentVersions }>('getContentVersions');
    const result = await fn({});
    if (auth?.currentUser?.uid !== uid) return [];
    return applyContentVersionsSnapshot(result.versions, options);
  })().finally(() => {
    pendingChecks.delete(uid);
  });
  pendingChecks.set(uid, pending);
  return await pending;
}

export function subscribeContentVersionChanges(domain: ContentVersionDomain, listener: () => void | Promise<void>) {
  const domainListeners = listeners.get(domain) ?? new Set();
  domainListeners.add(listener);
  listeners.set(domain, domainListeners);
  return () => {
    domainListeners.delete(listener);
    if (domainListeners.size === 0) listeners.delete(domain);
  };
}

export function registerContentVersion(domain: ContentVersionDomain, version: number) {
  const uid = auth?.currentUser?.uid ?? '';
  if (!uid || !Number.isFinite(version)) return;
  const previous = readStoredVersions(uid)?.versions ?? { announcements: 1, facilities: 1, issues: 1 };
  if (version <= previous[domain]) return;
  previous[domain] = version;
  writeStoredVersions(uid, { versions: previous });
}

export function getContentVersion(domain: ContentVersionDomain) {
  const uid = auth?.currentUser?.uid ?? '';
  return readStoredVersions(uid)?.versions[domain] ?? 1;
}

export function hasContentVersionGap(domain: ContentVersionDomain, version: number) {
  if (!Number.isFinite(version) || version <= 0) return false;
  return version > getContentVersion(domain) + 1;
}

export function resetContentVersionState() {
  // Pending requests are scoped by uid and are discarded by session changes.
}
