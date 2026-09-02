import { invokeBackendAction } from '@/services/backend-action';
import type {
  FacilityCursor,
  FacilityInput,
  FacilityPageResult,
  FacilityRecord,
  FacilitySortOption,
  FacilityStatus,
  FacilitySummary,
} from '@/types';
import { toReadableBackendError } from '@/services/issues-core';
import { captureContentCacheWriteGuard, createContentCacheKey, getCachedContent, getCachedContentPersistent, markContentCachePrefixStale, runCoalescedContentRequest, setCachedContentFromRead } from '@/services/content-read-cache';
import { READ_REQUEST_TIMEOUT_MS } from '@/lib/request';
import { registerContentVersion } from '@/services/content-versions';

interface RawFacility {
  id: string;
  categoryId: string;
  title: string;
  location: string;
  status: FacilityStatus;
  affectedCount: number;
  authorUid: string;
  isOwnFacility: boolean;
  currentUserAffected: boolean;
  canManageFacility: boolean;
  content?: string;
  resultContent?: string | null;
  closedAt?: string | null;
  createdAt?: string | null;
  startedAt?: string | null;
  updatedAt?: string | null;
}

function date(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function normalizeFacility(value: RawFacility): FacilityRecord {
  return {
    id: value.id,
    category_id: value.categoryId,
    title: value.title,
    location: value.location,
    status: value.status,
    affected_count: value.affectedCount,
    author_uid: value.authorUid,
    isOwnFacility: value.isOwnFacility,
    currentUserAffected: value.currentUserAffected,
    canManageFacility: value.canManageFacility,
    content: value.content ?? '',
    result_content: value.resultContent ?? null,
    closed_at: date(value.closedAt),
    created_at: date(value.createdAt),
    started_at: date(value.startedAt),
    updated_at: date(value.updatedAt),
  };
}

function normalizeSummary(value: RawFacility): FacilitySummary {
  const facility = normalizeFacility(value);
  const { content: _content, result_content: _result, started_at: _started, closed_at: _closed, ...summary } = facility;
  return summary;
}

export async function listFacilities(input: {
  bucket: 'active' | 'closed'; categoryId: string; query?: string; sort?: FacilitySortOption; status?: FacilityStatus | ''; cursor?: FacilityCursor | null;
}, options: { forceRefresh?: boolean; signal?: AbortSignal } = {}): Promise<FacilityPageResult> {
  const cacheKey = createContentCacheKey([
    'facility-list-page', input.categoryId, input.bucket, input.status ?? '', input.sort ?? 'latest', input.query ?? '',
    input.cursor?.id ?? 'first', input.cursor?.createdAt ?? '', input.cursor?.affectedCount ?? '',
  ]);
  const cached = options.forceRefresh ? null : await getCachedContentPersistent<FacilityPageResult>(cacheKey);
  if (cached) {
    registerContentVersion('facilities', cached.version);
    return cached;
  }
  const cacheGuard = captureContentCacheWriteGuard(cacheKey);
  try {
    const fn = invokeBackendAction<typeof input & { pageSize: number }, { facilities: RawFacility[]; cursor: FacilityCursor | null; hasMore: boolean; version: number }>(
      'listFacilities', { signal: options.signal, timeoutMs: READ_REQUEST_TIMEOUT_MS },
    );
    const result = await fn({ ...input, pageSize: 20 });
    const page = { ...result, facilities: result.facilities.map(normalizeSummary) };
    setCachedContentFromRead(cacheGuard, page);
    registerContentVersion('facilities', result.version);
    return page;
  } catch (error) { throw toReadableBackendError(error); }
}

export async function getFacility(facilityId: string, options: { forceRefresh?: boolean } = {}) {
  const cacheKey = createContentCacheKey(['facility-detail', facilityId]);
  if (!options.forceRefresh) {
    const cached = await getCachedContentPersistent<FacilityRecord>(cacheKey);
    if (cached) return cached;
  }
  return runCoalescedContentRequest(cacheKey, async (cacheGuard) => { try {
    const fn = invokeBackendAction<{ facilityId: string }, { facility: RawFacility }>('getFacility');
    const facility = normalizeFacility((await fn({ facilityId })).facility);
    setCachedContentFromRead(cacheGuard, facility);
    return facility;
  } catch (error) { throw toReadableBackendError(error); } });
}

export function peekFacility(facilityId: string) {
  return getCachedContent<FacilityRecord>(
    createContentCacheKey(['facility-detail', facilityId]),
  );
}

export async function createFacility(input: FacilityInput) {
  try {
    const fn = invokeBackendAction<FacilityInput, { facility: RawFacility }>('createFacility');
    const facility = normalizeFacility((await fn(input)).facility);
    markContentCachePrefixStale('facility-list-page|');
    return facility;
  } catch (error) { throw toReadableBackendError(error); }
}

export async function toggleFacilityAffected(facilityId: string) {
  try {
    const fn = invokeBackendAction<{ facilityId: string }, { affected: boolean; affectedCount: number }>('toggleFacilityAffected');
    const result = await fn({ facilityId });
    markContentCachePrefixStale('facility-list-page|');
    markContentCachePrefixStale(`facility-detail|${facilityId}`);
    return { ...result, affected_count: result.affectedCount };
  } catch (error) { throw toReadableBackendError(error); }
}

export async function updateFacilityStatus(facilityId: string, status: FacilityStatus, resultContent?: string) {
  try {
    const fn = invokeBackendAction<{ facilityId: string; status: FacilityStatus; resultContent?: string }, { facility: RawFacility }>('updateFacilityStatus');
    const facility = normalizeFacility((await fn({ facilityId, status, resultContent })).facility);
    markContentCachePrefixStale('facility-list-page|');
    markContentCachePrefixStale(`facility-detail|${facilityId}`);
    return facility;
  } catch (error) { throw toReadableBackendError(error); }
}

export async function deleteFacility(facilityId: string) {
  try {
    const fn = invokeBackendAction<{ facilityId: string }, { success: boolean }>('deleteFacility');
    const result = await fn({ facilityId });
    markContentCachePrefixStale('facility-list-page|');
    markContentCachePrefixStale(`facility-detail|${facilityId}`);
    return result;
  } catch (error) { throw toReadableBackendError(error); }
}
