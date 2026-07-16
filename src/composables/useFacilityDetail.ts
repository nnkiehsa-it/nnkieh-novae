import { computed, onScopeDispose, ref, watch, type Ref } from 'vue';
import { useRoute } from 'vue-router';
import { deleteFacility, getFacility, toggleFacilityAffected, updateFacilityStatus } from '@/services/facilities';
import type { FacilityStatus } from '@/types';
import { subscribeContentRevisionChanges } from '@/services/content-revisions';
import { normalizeRouteParam } from '@/lib/route';

export function useFacilityDetail(canLoad: Ref<boolean>) {
  const route = useRoute();
  const facility = ref<Awaited<ReturnType<typeof getFacility>> | null>(null);
  const loading = ref(true);
  const affecting = ref(false);
  const error = ref('');
  const facilityId = computed(() => normalizeRouteParam(route.params.facilityId));
  let requestVersion = 0;

  async function load(options: { silent?: boolean } = {}) {
    const id = facilityId.value;
    if (!canLoad.value || !id) return;
    const version = ++requestVersion;
    if (!options.silent) loading.value = true;
    error.value = '';
    try {
      const result = await getFacility(id);
      if (version === requestVersion) facility.value = result;
    } catch (caught) {
      if (version === requestVersion) {
        if (!options.silent || !facility.value) {
          error.value = caught instanceof Error ? caught.message : '設備載入失敗。';
        }
      }
    } finally {
      if (version === requestVersion && !options.silent) loading.value = false;
    }
  }

  async function toggleAffected() {
    if (!facility.value || facility.value.isOwnFacility || affecting.value) return;
    affecting.value = true;
    try {
      const result = await toggleFacilityAffected(facility.value.id);
      facility.value.currentUserAffected = result.affected;
      facility.value.affected_count = result.affected_count;
    } finally {
      affecting.value = false;
    }
  }

  async function changeStatus(status: FacilityStatus, resultContent?: string) {
    if (!facility.value) return;
    facility.value = await updateFacilityStatus(facility.value.id, status, resultContent);
  }
  async function remove() {
    if (!facility.value) return;
    await deleteFacility(facility.value.id);
  }

  watch(
    [canLoad, facilityId],
    ([allowed, id]) => {
      requestVersion += 1;
      facility.value = null;
      error.value = '';
      if (!allowed || !id) {
        loading.value = false;
        return;
      }
      void load();
    },
    { immediate: true },
  );

  const unsubscribeRevision = subscribeContentRevisionChanges('facilities', () => load({ silent: true }));
  onScopeDispose(unsubscribeRevision);
  return { affecting, changeStatus, error, facility, load, loading, remove, toggleAffected };
}
