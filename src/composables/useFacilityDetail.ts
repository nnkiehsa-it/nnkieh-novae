import { computed, onScopeDispose, ref, watch, type Ref } from 'vue';
import { useRoute } from 'vue-router';
import { deleteFacility, getFacility, toggleFacilityAffected, updateFacilityStatus } from '@/services/facilities';
import type { FacilityStatus } from '@/types';
import { subscribeContentVersionChanges } from '@/services/content-versions';
import { normalizeRouteParam } from '@/lib/route';
import { subscribeContentRealtimeEvents } from '@/services/realtime-events';

export function useFacilityDetail(canLoad: Ref<boolean>) {
  const route = useRoute();
  const facility = ref<Awaited<ReturnType<typeof getFacility>> | null>(null);
  const loading = ref(true);
  const affecting = ref(false);
  const error = ref('');
  const facilityId = computed(() => normalizeRouteParam(route.params.facilityId));
  let requestVersion = 0;
  let realtimeUnsubscribe: (() => void) | null = null;

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
          error.value = caught instanceof Error ? caught.message : 'facility.failedToLoadFacility';
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

  const unsubscribeVersion = subscribeContentVersionChanges('facilities', () => load({ silent: true }));
  watch(
    [canLoad, facilityId],
    ([allowed, id]) => {
      realtimeUnsubscribe?.();
      realtimeUnsubscribe = null;
      if (!allowed || !id) return;
      realtimeUnsubscribe = subscribeContentRealtimeEvents(
        `facility-detail:${id}`,
        (event) => {
          if (event.eventType !== 'facility_changed' || event.targetId !== id) return;
          if (event.op === 'delete') {
            facility.value = null;
            error.value = 'facility.failedToLoadFacility';
            return;
          }
          const version = ++requestVersion;
          void getFacility(id, { forceRefresh: true }).then((updated) => {
            if (version === requestVersion) facility.value = updated;
          }).catch(() => {
            // Keep the current detail visible across transient realtime fetch failures.
          });
        },
      );
    },
    { immediate: true },
  );
  onScopeDispose(() => {
    realtimeUnsubscribe?.();
    unsubscribeVersion();
  });
  return { affecting, changeStatus, error, facility, load, loading, remove, toggleAffected };
}
