import { invokeBackendAction } from '@/services/backend-action';
import { createRequestId } from '@/lib/request-id';
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
import { captureContentCacheWriteGuard, createContentCacheKey, getCachedContentPersistent, markContentCachePrefixStale, runCoalescedContentRequest, setCachedContentFromRead } from '@/services/content-read-cache';
import { READ_REQUEST_TIMEOUT_MS } from '@/lib/request';
import { prepareContentRevisionRead } from '@/services/content-revisions';

interface RawFacility extends Omit<FacilityRecord, 'closed_at' | 'created_at' | 'started_at' | 'updated_at'> {
  closed_at?: string | null;
  created_at?: string | null;
  started_at?: string | null;
  updated_at?: string | null;
}

function date(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function normalizeFacility(value: RawFacility): FacilityRecord {
  return {
    ...value,
    content: value.content ?? '',
    result_content: value.result_content ?? null,
    closed_at: date(value.closed_at),
    created_at: date(value.created_at),
    started_at: date(value.started_at),
    updated_at: date(value.updated_at),
  };
}

function normalizeSummary(value: RawFacility): FacilitySummary {
  const facility = normalizeFacility(value);
  const { content: _content, result_content: _result, started_at: _started, closed_at: _closed, ...summary } = facility;
  return summary;
}

export async function listFacilities(input: {
  bucket: 'active' | 'closed'; categoryId: string; query?: string; sort?: FacilitySortOption; status?: FacilityStatus | ''; cursor?: FacilityCursor | null;
}, options: { signal?: AbortSignal } = {}): Promise<FacilityPageResult> {
  await prepareContentRevisionRead();
  const cacheKey = createContentCacheKey([
    'facility-list-page', input.categoryId, input.bucket, input.status ?? '', input.sort ?? 'latest', input.query ?? '',
    input.cursor?.id ?? 'first', input.cursor?.createdAt ?? '', input.cursor?.affectedCount ?? '',
  ]);
  const cached = await getCachedContentPersistent<FacilityPageResult>(cacheKey);
  if (cached) return cached;
  const cacheGuard = captureContentCacheWriteGuard(cacheKey);
  try {
    const fn = invokeBackendAction<typeof input & { pageSize: number }, { facilities: RawFacility[]; cursor: FacilityCursor | null; hasMore: boolean }>(
      'listFacilities', { signal: options.signal, timeoutMs: READ_REQUEST_TIMEOUT_MS },
    );
    const result = await fn({ ...input, pageSize: 20 });
    const page = { ...result, facilities: result.facilities.map(normalizeSummary) };
    setCachedContentFromRead(cacheGuard, page);
    return page;
  } catch (error) { throw toReadableBackendError(error); }
}

export async function getFacility(facilityId: string, options: { forceRefresh?: boolean } = {}) {
  if (!options.forceRefresh) await prepareContentRevisionRead();
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

export async function createFacility(input: FacilityInput) {
  try {
    const fn = invokeBackendAction<FacilityInput & { requestId: string }, { facility: RawFacility }>('createFacility');
    const facility = normalizeFacility((await fn({ ...input, requestId: createRequestId() })).facility);
    markContentCachePrefixStale('facility-list-page|');
    return facility;
  } catch (error) { throw toReadableBackendError(error); }
}

export async function toggleFacilityAffected(facilityId: string) {
  try {
    const fn = invokeBackendAction<{ facilityId: string; requestId: string }, { affected: boolean; affected_count: number }>('toggleFacilityAffected');
    const result = await fn({ facilityId, requestId: createRequestId() });
    markContentCachePrefixStale('facility-list-page|');
    markContentCachePrefixStale(`facility-detail|${facilityId}`);
    return result;
  } catch (error) { throw toReadableBackendError(error); }
}

export async function updateFacilityStatus(facilityId: string, status: FacilityStatus, resultContent?: string) {
  try {
    const fn = invokeBackendAction<{ facilityId: string; status: FacilityStatus; resultContent?: string; requestId: string }, { facility: RawFacility }>('updateFacilityStatus');
    const facility = normalizeFacility((await fn({ facilityId, status, resultContent, requestId: createRequestId() })).facility);
    markContentCachePrefixStale('facility-list-page|');
    markContentCachePrefixStale(`facility-detail|${facilityId}`);
    return facility;
  } catch (error) { throw toReadableBackendError(error); }
}

export async function deleteFacility(facilityId: string) {
  try {
    const fn = invokeBackendAction<{ facilityId: string; requestId: string }, { success: boolean }>('deleteFacility');
    const result = await fn({ facilityId, requestId: createRequestId() });
    markContentCachePrefixStale('facility-list-page|');
    markContentCachePrefixStale(`facility-detail|${facilityId}`);
    return result;
  } catch (error) { throw toReadableBackendError(error); }
}
