import type { ActionRequest } from '@shared/actions.ts';
import type { FacilityStatus } from '@shared/contracts/facilities.ts';
import { callAction } from '@/services/backend-action';
import type { FacilityPageResult } from '@/types';
import { toReadableBackendError } from '@/services/backend-errors';
import { invalidate, invalidateLists, seedQuery } from '@/lib/query-client';
import { readRequestTimeoutMs } from '@/lib/request';
import { registerContentVersion } from '@/services/content-versions';

export const facilityKeys = {
  list: (params: Record<string, string>) => ['facilities', 'list', params] as const,
  counts: (categoryId: string) => ['facilities', 'list', 'counts', categoryId] as const,
  detail: (facilityId: string) => ['facilities', 'detail', facilityId] as const,
};

export async function listFacilities(input: ActionRequest<'listFacilities'>, signal?: AbortSignal): Promise<FacilityPageResult> {
  try {
    const page = await callAction('listFacilities', input, { signal, timeoutMs: readRequestTimeoutMs });
    registerContentVersion('facilities', page.version);
    return page;
  } catch (error) { throw toReadableBackendError(error); }
}

/** How many reports of a category are in each status, as the first page of its list reports them. */
export async function getFacilityStatusCounts(categoryId: string, signal?: AbortSignal) {
  const { statusCounts } = await listFacilities({ categoryId, bucket: 'active', pageSize: 1 }, signal);
  if (!statusCounts) throw new Error('A first facility page arrived without its status counts.');
  return statusCounts;
}

export async function getFacility(facilityId: string, signal?: AbortSignal) {
  try {
    return (await callAction('getFacility', { facilityId }, { signal, timeoutMs: readRequestTimeoutMs })).facility;
  } catch (error) { throw toReadableBackendError(error); }
}

/** What one change to a report makes stale: every list, and the report itself. */
export function invalidateFacility(facilityId?: string) {
  void invalidateLists('facilities');
  if (facilityId) void invalidate(facilityKeys.detail(facilityId));
}

export async function createFacility(input: ActionRequest<'createFacility'>) {
  try {
    const { facility } = await callAction('createFacility', input);
    seedQuery(facilityKeys.detail(facility.id), facility);
    invalidateFacility();
    return facility;
  } catch (error) { throw toReadableBackendError(error); }
}

export async function toggleFacilityAffected(facilityId: string) {
  try {
    const result = await callAction('toggleFacilityAffected', { facilityId });
    invalidateFacility(facilityId);
    return result;
  } catch (error) { throw toReadableBackendError(error); }
}

export async function updateFacilityStatus(facilityId: string, status: Exclude<FacilityStatus, 'pending'>, resultContent?: string) {
  try {
    const { facility } = await callAction('updateFacilityStatus', { facilityId, status, resultContent });
    invalidateFacility(facilityId);
    return facility;
  } catch (error) { throw toReadableBackendError(error); }
}

export async function deleteFacility(facilityId: string) {
  try {
    const result = await callAction('deleteFacility', { facilityId });
    void invalidateLists('facilities');
    return result;
  } catch (error) { throw toReadableBackendError(error); }
}
