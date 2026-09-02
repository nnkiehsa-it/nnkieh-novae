import type {
  AnnouncementRecord,
  AnnouncementSummary,
  FacilityRecord,
  FacilitySummary,
  IssueRecord,
  IssueSummary,
} from "@/types";

export type ContentEntityDomain = "announcement" | "facility" | "issue";

export type SummaryEntity =
  | AnnouncementSummary
  | FacilitySummary
  | IssueSummary;

export type DetailEntity =
  | AnnouncementRecord
  | FacilityRecord
  | IssueRecord;

export type ContentEntity = SummaryEntity | DetailEntity;

export type ContentEntityCompleteness = "detail" | "summary";

interface StoreEntry<T> {
  localRevision: number;
  serverRevision: number;
  value: T;
}

const summaryEntries = new Map<string, StoreEntry<SummaryEntity>>();
const detailEntries = new Map<string, StoreEntry<DetailEntity>>();

const entityListeners = new Map<string, Set<() => void>>();
const domainListeners = new Map<string, Set<() => void>>();
const domainVersions = new Map<string, number>();
let localRevision = 0;

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
  return ++localRevision;
}

function getEntityRevision(entity: unknown): number {
  if (entity && typeof entity === "object" && "revision" in entity) {
    const rev = Number((entity as { revision?: unknown }).revision);
    if (Number.isFinite(rev)) return rev;
  }
  return 0;
}

export function mergeContentEntityRead<T extends ContentEntity>(
  scope: string | undefined,
  domain: ContentEntityDomain,
  incoming: T,
  readRevision: number,
  completeness: ContentEntityCompleteness = "detail",
): T {
  const key = entityKey(scope, domain, incoming.id);
  const incomingServerRevision = getEntityRevision(incoming);

  if (completeness === "detail") {
    const current = detailEntries.get(key);
    if (current) {
      if (incomingServerRevision > 0 && current.serverRevision > incomingServerRevision) {
        // Newer server revision already present in detail store; reject stale read
        return current.value as unknown as T;
      }
      if (current.localRevision > readRevision) {
        return current.value as unknown as T;
      }
    }
    const nextValue = { ...(current?.value ?? {}), ...incoming } as unknown as DetailEntity;
    detailEntries.set(key, {
      localRevision: readRevision,
      serverRevision: incomingServerRevision,
      value: nextValue,
    });
  } else {
    // Summary completeness — saved strictly in summary store
    const current = summaryEntries.get(key);
    if (current) {
      if (incomingServerRevision > 0 && current.serverRevision > incomingServerRevision) {
        // Newer server revision already present in summary store; reject stale read
        return current.value as unknown as T;
      }
      if (current.localRevision > readRevision) {
        return current.value as unknown as T;
      }
    }
    const nextValue = { ...(current?.value ?? {}), ...incoming } as unknown as SummaryEntity;
    summaryEntries.set(key, {
      localRevision: readRevision,
      serverRevision: incomingServerRevision,
      value: nextValue,
    });
  }

  notify(scope, domain, incoming.id);
  return incoming;
}

export function patchContentEntity<T extends ContentEntity>(
  scope: string | undefined,
  domain: ContentEntityDomain,
  id: string,
  patch: Partial<T>,
  options: { completeness?: ContentEntityCompleteness | "both"; serverRevision?: number } = {},
) {
  const key = entityKey(scope, domain, id);
  const currentDetail = detailEntries.get(key);
  const currentSummary = summaryEntries.get(key);

  if (!currentDetail && !currentSummary) return null;
  const nextRev = ++localRevision;
  const completeness = options.completeness
    ?? (("content" in patch || "result_content" in patch) ? "detail" : "both");
  const serverRevision = options.serverRevision ?? 0;

  if (currentDetail && completeness !== "summary" && (serverRevision <= 0 || currentDetail.serverRevision <= serverRevision)) {
    const value = { ...currentDetail.value, ...patch } as DetailEntity;
    detailEntries.set(key, {
      localRevision: nextRev,
      serverRevision: Math.max(currentDetail.serverRevision, serverRevision),
      value,
    });
  }

  if (currentSummary && completeness !== "detail" && (serverRevision <= 0 || currentSummary.serverRevision <= serverRevision)) {
    const value = { ...currentSummary.value, ...patch } as SummaryEntity;
    summaryEntries.set(key, {
      localRevision: nextRev,
      serverRevision: Math.max(currentSummary.serverRevision, serverRevision),
      value,
    });
  }

  notify(scope, domain, id);
  return (currentDetail?.value ?? currentSummary?.value) as T;
}

export function removeContentEntity(
  scope: string | undefined,
  domain: ContentEntityDomain,
  id: string,
) {
  const key = entityKey(scope, domain, id);
  const removedDetail = detailEntries.delete(key);
  const removedSummary = summaryEntries.delete(key);
  if (removedDetail || removedSummary) {
    notify(scope, domain, id);
    return true;
  }
  return false;
}

export function getContentEntity<T extends ContentEntity>(
  scope: string | undefined,
  domain: ContentEntityDomain,
  id: string,
) {
  const key = entityKey(scope, domain, id);
  return (detailEntries.get(key)?.value ?? summaryEntries.get(key)?.value) as T | undefined;
}

export function getDetailContentEntity<T extends ContentEntity>(
  scope: string | undefined,
  domain: ContentEntityDomain,
  id: string,
) {
  const key = entityKey(scope, domain, id);
  return detailEntries.get(key)?.value as T | undefined;
}

export function getSummaryContentEntity<T extends SummaryEntity>(
  scope: string | undefined,
  domain: ContentEntityDomain,
  id: string,
) {
  const key = entityKey(scope, domain, id);
  return summaryEntries.get(key)?.value as T | undefined;
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
  for (const key of [...detailEntries.keys()]) {
    if (key.startsWith(prefix)) detailEntries.delete(key);
  }
  for (const key of [...summaryEntries.keys()]) {
    if (key.startsWith(prefix)) summaryEntries.delete(key);
  }
  for (const key of [...entityListeners.keys()]) {
    if (key.startsWith(prefix)) entityListeners.delete(key);
  }
  for (const key of [...domainListeners.keys()]) {
    if (key.startsWith(prefix)) domainListeners.delete(key);
  }
  for (const key of [...domainVersions.keys()]) {
    if (key.startsWith(prefix)) domainVersions.delete(key);
  }
}

export function clearContentEntityDomain(
  scope: string | undefined,
  domain: ContentEntityDomain,
) {
  const prefix = `${normalizedScope(scope)}|${domain}|`;
  for (const key of [...detailEntries.keys()]) {
    if (key.startsWith(prefix)) detailEntries.delete(key);
  }
  for (const key of [...summaryEntries.keys()]) {
    if (key.startsWith(prefix)) summaryEntries.delete(key);
  }
  const key = domainKey(scope, domain);
  domainVersions.set(key, (domainVersions.get(key) ?? 0) + 1);
  domainListeners.get(key)?.forEach((listener) => listener());
}
