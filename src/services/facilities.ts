import type { ActionRequest } from '@shared/actions.ts';
import type { Facility, FacilityStatus } from '@shared/contracts/facilities.ts';
import { callAction } from '@/services/backend-action';
import type { FacilityPageResult } from '@/types';
import { toReadableBackendError } from '@/services/backend-errors';
import { captureContentCacheWriteGuard, createContentCacheKey, getCachedContent, getCachedContentPersistent, markContentCachePrefixStale, runCoalescedContentRequest, setCachedContentFromRead } from '@/services/content-read-cache';
import { readRequestTimeoutMs } from '@/lib/request';
import { registerContentVersion } from '@/services/content-versions';

type FacilityListRequest = Omit<ActionRequest<'listFacilities'>, 'pageSize'>;

export async function listFacilities(
  input: FacilityListRequest,
  options: { forceRefresh?: boolean; signal?: AbortSignal; pageSize?: number } = {},
): Promise<FacilityPageResult> {
  const pageSize = options.pageSize ?? 20;
  const cacheKey = createContentCacheKey([
    'facility-list-page', 'summary-v2', input.categoryId, input.bucket ?? 'active', input.status ?? '', input.sort ?? 'latest', input.query ?? '',
    input.cursor?.id ?? 'first', input.cursor?.createdAt ?? '', input.cursor?.affectedCount ?? '',
    pageSize,
  ]);
  const cached = options.forceRefresh ? null : await getCachedContentPersistent<FacilityPageResult>(cacheKey);
  if (cached) {
    registerContentVersion('facilities', cached.version);
    return cached;
  }
  const cacheGuard = captureContentCacheWriteGuard(cacheKey);
  try {
    const page = await callAction('listFacilities', { ...input, pageSize }, { signal: options.signal, timeoutMs: readRequestTimeoutMs });
    setCachedContentFromRead(cacheGuard, page);
    registerContentVersion('facilities', page.version);
    return page;
  } catch (error) { throw toReadableBackendError(error); }
}

/** How many reports of a category are in each status, as the first page of its list reports them. */
export async function getFacilityStatusCounts(categoryId: string, options: { forceRefresh?: boolean; signal?: AbortSignal } = {}) {
  const { statusCounts } = await listFacilities({ categoryId, bucket: 'active' }, { ...options, pageSize: 1 });
  if (!statusCounts) throw new Error('A first facility page arrived without its status counts.');
  return statusCounts;
}

export async function getFacility(facilityId: string, options: { forceRefresh?: boolean } = {}) {
  const cacheKey = createContentCacheKey(['facility-detail', facilityId]);
  if (!options.forceRefresh) {
    const cached = await getCachedContentPersistent<Facility>(cacheKey);
    if (cached) return cached;
  }
  return runCoalescedContentRequest(cacheKey, async (cacheGuard) => { try {
    const { facility } = await callAction('getFacility', { facilityId });
    setCachedContentFromRead(cacheGuard, facility);
    return facility;
  } catch (error) { throw toReadableBackendError(error); } });
}

export function peekFacility(facilityId: string) {
  return getCachedContent<Facility>(createContentCacheKey(['facility-detail', facilityId]));
}

function markFacilityStale(facilityId?: string) {
  markContentCachePrefixStale('facility-list-page|');
  if (facilityId) markContentCachePrefixStale(`facility-detail|${facilityId}`);
}

export async function createFacility(input: ActionRequest<'createFacility'>) {
  try {
    const { facility } = await callAction('createFacility', input);
    markFacilityStale();
    return facility;
  } catch (error) { throw toReadableBackendError(error); }
}

export async function toggleFacilityAffected(facilityId: string) {
  try {
    const result = await callAction('toggleFacilityAffected', { facilityId });
    markFacilityStale(facilityId);
    return result;
  } catch (error) { throw toReadableBackendError(error); }
}

export async function updateFacilityStatus(facilityId: string, status: Exclude<FacilityStatus, 'pending'>, resultContent?: string) {
  try {
    const { facility } = await callAction('updateFacilityStatus', { facilityId, status, resultContent });
    markFacilityStale(facilityId);
    return facility;
  } catch (error) { throw toReadableBackendError(error); }
}

export async function deleteFacility(facilityId: string) {
  try {
    const result = await callAction('deleteFacility', { facilityId });
    markFacilityStale(facilityId);
    return result;
  } catch (error) { throw toReadableBackendError(error); }
}
