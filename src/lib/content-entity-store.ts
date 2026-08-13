import type {
  AnnouncementRecord,
  FacilityRecord,
  FacilitySummary,
  IssueRecord,
} from "@/types";

export type ContentEntityDomain = "announcement" | "facility" | "issue";
export type ContentEntity =
  | AnnouncementRecord
  | FacilityRecord
  | FacilitySummary
  | IssueRecord;

interface ContentEntityEntry {
  fields: Map<string, number>;
  value: ContentEntity;
}

const entries = new Map<string, ContentEntityEntry>();
const entityListeners = new Map<string, Set<() => void>>();
const domainListeners = new Map<string, Set<() => void>>();
const domainVersions = new Map<string, number>();
let revision = 0;

function normalizedScope(scope: string | undefined) {
  return scope?.trim() || "anonymous";
}

function entityKey(
  scope: string | undefined,
  domain: ContentEntityDomain,
  id: string,
) {
  return `${normalizedScope(scope)}|${domain}|${id}`;
}

function domainKey(scope: string | undefined, domain: ContentEntityDomain) {
  return `${normalizedScope(scope)}|${domain}`;
}

function notify(
  scope: string | undefined,
  domain: ContentEntityDomain,
  id: string,
) {
  entityListeners
    .get(entityKey(scope, domain, id))
    ?.forEach((listener) => listener());
  const key = domainKey(scope, domain);
  domainVersions.set(key, (domainVersions.get(key) ?? 0) + 1);
  domainListeners.get(key)?.forEach((listener) => listener());
}

export function beginContentEntityRead() {
  return ++revision;
}

export function mergeContentEntityRead<T extends ContentEntity>(
  scope: string | undefined,
  domain: ContentEntityDomain,
  incoming: T,
  readRevision: number,
) {
  const key = entityKey(scope, domain, incoming.id);
  const current = entries.get(key);
  const nextValue = { ...(current?.value ?? {}), ...incoming } as T;
  const nextFields = new Map(current?.fields);

  if (current) {
    for (const [field, value] of Object.entries(incoming)) {
      if ((current.fields.get(field) ?? 0) > readRevision) {
        (nextValue as unknown as Record<string, unknown>)[field] = (
          current.value as unknown as Record<string, unknown>
        )[field];
      } else {
        (nextValue as unknown as Record<string, unknown>)[field] = value;
        nextFields.set(field, readRevision);
      }
    }
  } else {
    Object.keys(incoming).forEach((field) => nextFields.set(field, readRevision));
  }

  entries.set(key, { fields: nextFields, value: nextValue });
  notify(scope, domain, incoming.id);
  return nextValue;
}

export function patchContentEntity<T extends ContentEntity>(
  scope: string | undefined,
  domain: ContentEntityDomain,
  id: string,
  patch: Partial<T>,
) {
  const key = entityKey(scope, domain, id);
  const current = entries.get(key);
  if (!current) return null;
  const patchRevision = ++revision;
  const fields = new Map(current.fields);
  Object.keys(patch).forEach((field) => fields.set(field, patchRevision));
  const value = { ...current.value, ...patch } as T;
  entries.set(key, { fields, value });
  notify(scope, domain, id);
  return value;
}

export function removeContentEntity(
  scope: string | undefined,
  domain: ContentEntityDomain,
  id: string,
) {
  const removed = entries.delete(entityKey(scope, domain, id));
  if (removed) notify(scope, domain, id);
  return removed;
}

export function getContentEntity<T extends ContentEntity>(
  scope: string | undefined,
  domain: ContentEntityDomain,
  id: string,
) {
  return entries.get(entityKey(scope, domain, id))?.value as T | undefined;
}

export function getContentEntityDomainVersion(
  scope: string | undefined,
  domain: ContentEntityDomain,
) {
  return domainVersions.get(domainKey(scope, domain)) ?? 0;
}

export function subscribeContentEntity(
  scope: string | undefined,
  domain: ContentEntityDomain,
  id: string,
  listener: () => void,
) {
  const key = entityKey(scope, domain, id);
  const listeners = entityListeners.get(key) ?? new Set();
  listeners.add(listener);
  entityListeners.set(key, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) entityListeners.delete(key);
  };
}

export function subscribeContentEntityDomain(
  scope: string | undefined,
  domain: ContentEntityDomain,
  listener: () => void,
) {
  const key = domainKey(scope, domain);
  const listeners = domainListeners.get(key) ?? new Set();
  listeners.add(listener);
  domainListeners.set(key, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) domainListeners.delete(key);
  };
}

export function clearContentEntityScope(scope: string | undefined) {
  const prefix = `${normalizedScope(scope)}|`;
  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) entries.delete(key);
  }
}
