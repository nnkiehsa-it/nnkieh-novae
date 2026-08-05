import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import { deleteFacility, getFacility, listFacilities, toggleFacilityAffected, updateFacilityStatus } from '@/services/facilities';
import { isAbortFailure } from '@/lib/request';
import { normalizeSearchText } from '@/lib/search';
import { FACILITY_STATUS_LABELS, isFacilityClosed } from '@/constants/statuses';
import type { FacilityCursor, FacilitySortOption, FacilityStatus, FacilitySummary } from '@/types';
import { hasContentVersionGap, registerContentVersion, subscribeContentVersionChanges } from '@/services/content-versions';
import { subscribeContentRealtimeEvents } from '@/services/realtime-events';
import { isContentUnavailableError } from '@/services/issues-core';
import { preserveContentListScroll } from '@/lib/content-list-scroll';

export function useFacilities(categoryId: Ref<string>) {
  const bucket = ref<'active' | 'closed'>('active');
  const status = ref<FacilityStatus | ''>('');
  const sort = ref<FacilitySortOption>('latest');
  const query = ref('');
  const committedQuery = ref('');
  const facilities = ref<FacilitySummary[]>([]);
  const browseFacilities = ref<FacilitySummary[]>([]);
  const cursor = ref<FacilityCursor | null>(null);
  const browseCursor = ref<FacilityCursor | null>(null);
  const hasMore = ref(false);
  const browseHasMore = ref(false);
  const loading = ref(false);
  const loadingMore = ref(false);
  const affectingFacilityId = ref('');
  const error = ref('');
  let requestVersion = 0;
  let requestController: AbortController | null = null;
  const MIN_REMOTE_SEARCH_LENGTH = 3;

  const visibleFacilities = computed(() => {
    const normalized = normalizeSearchText(committedQuery.value);
    if (!normalized || normalized.length >= MIN_REMOTE_SEARCH_LENGTH) return facilities.value;
    return facilities.value.filter((facility) =>
      normalizeSearchText(`${facility.title} ${facility.location}`).includes(normalized));
  });

  async function load(append = false, options: { forceRefresh?: boolean; silent?: boolean } = {}) {
    const version = ++requestVersion;
    requestController?.abort();
    const controller = new AbortController();
    requestController = controller;
    if (append) loadingMore.value = true;
    else if (!options.silent) loading.value = true;
    error.value = '';
    try {
      const normalizedQuery = normalizeSearchText(committedQuery.value);
      const remoteQuery = normalizedQuery.length >= MIN_REMOTE_SEARCH_LENGTH ? normalizedQuery : '';
      const result = await listFacilities({
        bucket: bucket.value, categoryId: categoryId.value, status: status.value, sort: sort.value,
        query: remoteQuery,
        cursor: append ? cursor.value : null,
      }, { forceRefresh: options.forceRefresh, signal: controller.signal });
      if (version !== requestVersion) return;
      facilities.value = append ? [...facilities.value, ...result.facilities] : result.facilities;
      cursor.value = result.cursor;
      hasMore.value = normalizedQuery.length > 0 && normalizedQuery.length < MIN_REMOTE_SEARCH_LENGTH
        ? false
        : result.hasMore;
      if (!remoteQuery) {
        browseFacilities.value = facilities.value;
        browseCursor.value = result.cursor;
        browseHasMore.value = result.hasMore;
      }
    } catch (caught) {
      if (isAbortFailure(caught)) return;
      if (version === requestVersion && (!options.silent || facilities.value.length === 0)) {
        error.value = caught instanceof Error ? caught.message : 'facility.failedToLoadFacility';
      }
    } finally {
      if (version === requestVersion) (append ? loadingMore : loading).value = false;
      if (requestController === controller) requestController = null;
    }
  }

  async function toggleAffected(facility: FacilitySummary) {
    if (
      affectingFacilityId.value
      || facility.isOwnFacility
      || isFacilityClosed(facility.status)
    ) return;
    affectingFacilityId.value = facility.id;
    try {
      const result = await toggleFacilityAffected(facility.id);
      facility.currentUserAffected = result.affected;
      facility.affected_count = result.affected_count;
    } finally {
      affectingFacilityId.value = '';
    }
  }

  async function changeStatus(facility: FacilitySummary, nextStatus: FacilityStatus, result?: string) {
    const updated = await updateFacilityStatus(facility.id, nextStatus, result);
    const updateCollection = (collection: FacilitySummary[]) => {
      const index = collection.findIndex((entry) => entry.id === facility.id);
      if (index < 0) return;
      if (bucket.value === 'active' && isFacilityClosed(updated.status)) {
        collection.splice(index, 1);
      } else {
        collection.splice(index, 1, updated);
      }
    };
    updateCollection(facilities.value);
    if (facilities.value !== browseFacilities.value) updateCollection(browseFacilities.value);
  }

  async function remove(facility: FacilitySummary) {
    await deleteFacility(facility.id);
    facilities.value = facilities.value.filter((entry) => entry.id !== facility.id);
    browseFacilities.value = browseFacilities.value.filter((entry) => entry.id !== facility.id);
  }

  const statusOptions = computed(() => bucket.value === 'closed'
    ? [
      { value: '', label: 'facility.all' },
      { value: 'completed', label: FACILITY_STATUS_LABELS.completed },
      { value: 'unable-to-handle', label: FACILITY_STATUS_LABELS['unable-to-handle'] },
    ]
    : [
      { value: '', label: 'facility.all' },
      { value: 'pending', label: FACILITY_STATUS_LABELS.pending },
      { value: 'processing', label: FACILITY_STATUS_LABELS.processing },
    ]);

  function restoreBrowseResults() {
    requestVersion += 1;
    requestController?.abort();
    requestController = null;
    facilities.value = browseFacilities.value;
    cursor.value = browseCursor.value;
    hasMore.value = normalizeSearchText(committedQuery.value) ? false : browseHasMore.value;
    loading.value = false;
    loadingMore.value = false;
    error.value = '';
  }

  function submitSearch() {
    const normalized = normalizeSearchText(query.value);
    if (normalized === normalizeSearchText(committedQuery.value)) return;
    committedQuery.value = normalized;
    cursor.value = null;
    if (normalized.length >= MIN_REMOTE_SEARCH_LENGTH) {
      void load();
    } else {
      restoreBrowseResults();
    }
  }

  function clearSearch() {
    query.value = '';
    committedQuery.value = '';
    restoreBrowseResults();
  }

  function sortFacilityCollection(collection: FacilitySummary[]) {
    return [...collection].sort((left, right) => {
      if (sort.value === 'most-affected' && left.affected_count !== right.affected_count) {
        return right.affected_count - left.affected_count;
      }
      return (right.created_at?.getTime() ?? 0) - (left.created_at?.getTime() ?? 0);
    });
  }

  function matchesCurrentList(facility: FacilitySummary, includeRemoteQuery = true) {
    if (facility.category_id !== categoryId.value) return false;
    if (isFacilityClosed(facility.status) !== (bucket.value === 'closed')) return false;
    if (status.value && facility.status !== status.value) return false;
    const normalizedQuery = normalizeSearchText(committedQuery.value);
    if (!includeRemoteQuery || normalizedQuery.length < MIN_REMOTE_SEARCH_LENGTH) return true;
    return normalizeSearchText(`${facility.title} ${facility.location}`).includes(normalizedQuery);
  }

  function upsertRealtimeFacility(collection: FacilitySummary[], facility: FacilitySummary, includeRemoteQuery: boolean) {
    const withoutCurrent = collection.filter((entry) => entry.id !== facility.id);
    if (!matchesCurrentList(facility, includeRemoteQuery)) return withoutCurrent;
    return sortFacilityCollection([facility, ...withoutCurrent]);
  }

  function removeRealtimeFacility(facilityId: string) {
    facilities.value = facilities.value.filter((entry) => entry.id !== facilityId);
    browseFacilities.value = browseFacilities.value.filter((entry) => entry.id !== facilityId);
  }

  const unsubscribeVersion = subscribeContentVersionChanges(
    'facilities',
    () => preserveContentListScroll(() =>
      load(false, { forceRefresh: true, silent: facilities.value.length > 0 })
    ),
  );
  const unsubscribeRealtime = subscribeContentRealtimeEvents(
    `facilities:${categoryId.value}`,
    (event) => {
      if (event.eventType !== 'facility_changed') return;
      if (event.version > 0 && hasContentVersionGap('facilities', event.version)) {
        void load(false, { forceRefresh: true, silent: facilities.value.length > 0 });
        return;
      }
      if (event.op === 'delete' || event.category !== categoryId.value) {
        removeRealtimeFacility(event.targetId);
        registerContentVersion('facilities', event.version);
        return;
      }
      void getFacility(event.targetId, { forceRefresh: true }).then((facility) => {
        facilities.value = upsertRealtimeFacility(facilities.value, facility, true);
        browseFacilities.value = upsertRealtimeFacility(browseFacilities.value, facility, false);
        registerContentVersion('facilities', event.version);
      }).catch((caught) => {
        if (isContentUnavailableError(caught)) removeRealtimeFacility(event.targetId);
        else void load(false, { forceRefresh: true, silent: facilities.value.length > 0 });
      });
    },
  );
  watch([categoryId, status, sort], () => { cursor.value = null; void load(); });
  watch(bucket, () => { status.value = ''; cursor.value = null; void load(); });
  onMounted(() => void load());
  onBeforeUnmount(() => {
    unsubscribeVersion();
    unsubscribeRealtime();
    requestController?.abort();
  });

  return {
    affectingFacilityId,
    bucket,
    changeStatus,
    clearSearch,
    committedQuery,
    error,
    facilities: visibleFacilities,
    hasMore,
    load,
    loading,
    loadingMore,
    query,
    remove,
    sort,
    status,
    statusOptions,
    submitSearch,
    toggleAffected,
  };
}
