import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { deleteFacility, listFacilities, toggleFacilityAffected, updateFacilityStatus } from '@/services/facilities';
import { isAbortFailure } from '@/lib/request';
import { normalizeSearchText } from '@/lib/search';
import type { FacilityCursor, FacilitySortOption, FacilityStatus, FacilitySummary } from '@/types';
import { subscribeContentRevisionChanges } from '@/services/content-revisions';

export function useFacilities() {
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

  async function load(append = false) {
    const version = ++requestVersion;
    requestController?.abort();
    const controller = new AbortController();
    requestController = controller;
    (append ? loadingMore : loading).value = true;
    error.value = '';
    try {
      const normalizedQuery = normalizeSearchText(committedQuery.value);
      const remoteQuery = normalizedQuery.length >= MIN_REMOTE_SEARCH_LENGTH ? normalizedQuery : '';
      const result = await listFacilities({
        bucket: bucket.value, status: status.value, sort: sort.value,
        query: remoteQuery,
        cursor: append ? cursor.value : null,
      }, { signal: controller.signal });
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
      if (version === requestVersion) error.value = caught instanceof Error ? caught.message : '設備載入失敗。';
    } finally {
      if (version === requestVersion) (append ? loadingMore : loading).value = false;
      if (requestController === controller) requestController = null;
    }
  }

  async function toggleAffected(facility: FacilitySummary) {
    if (
      affectingFacilityId.value
      || facility.isOwnFacility
      || ['completed', 'unable-to-handle'].includes(facility.status)
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
      if (bucket.value === 'active' && ['completed', 'unable-to-handle'].includes(updated.status)) {
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
    ? [{ value: '', label: '全部' }, { value: 'completed', label: '已完成' }, { value: 'unable-to-handle', label: '無法處理' }]
    : [{ value: '', label: '全部' }, { value: 'pending', label: '待受理' }, { value: 'processing', label: '處理中' }]);

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

  const unsubscribeRevision = subscribeContentRevisionChanges('facilities', () => load());
  watch([status, sort], () => { cursor.value = null; void load(); });
  watch(bucket, () => { status.value = ''; cursor.value = null; void load(); });
  onMounted(() => void load());
  onBeforeUnmount(() => {
    unsubscribeRevision();
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
