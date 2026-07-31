<template>
  <RoutePageFrame layout="fill" class="relative">
    <div class="route-scroll-through scroll-shadow-space scrollbar-subtle min-h-0 flex-1 space-y-5 overflow-auto overscroll-contain">
      <BoardControls
        v-model:active-filter="category"
        v-model:status-tab="bucket"
        v-model:search-query="query"
        v-model:sort-option="sort"
        mode="facility"
        :active-category-label="activeCategoryLabel"
        :category-options="categoryOptions"
        :create-label="t('facility.addFacility')"
        :search-hint="searchHint"
        @create="openComposer"
        @submit-search="submitSearch"
        @clear-search="clearSearch"
      />

      <ContentListState
        :empty="facilities.length === 0"
        :empty-description="emptyDescription"
        empty-title="facility.noMatchingFacilities"
        :error="error"
        error-title="facility.failedToLoadFacilityTitle"
        :has-more="hasMore"
        :loading="visibleFacilityLoading"
        :loading-has-problem="facilityLoadingHasProblem"
        :loading-more="loadingMore"
        :panel-key="facilityPanelKey"
        :problem-description="facilityProblemDescription"
        :problem-title="facilityProblemTitle"
        :retry-disabled="!facilityOnline"
        @load-more="load(true)"
        @retry="retryFacilities"
      >
        <template #loading>
          <FacilityTable :facilities="[]" :loading="true" />
        </template>

        <template #loading-more>
          <FacilityTable :facilities="[]" :loading="true" :loading-count="1" />
        </template>

        <FacilityTable
          :affecting-facility-id="affectingFacilityId"
          :facilities="facilities"
          :loading="false"
          :highlight-query="committedQuery"
          @open-details="openDetails"
          @toggle-affected="handleToggleAffected"
        />

        <template #sentinel>
          <div ref="loadMoreSentinel" class="h-1" aria-hidden="true"></div>
        </template>
      </ContentListState>
    </div>
  </RoutePageFrame>
</template>

<script setup lang="ts">
import RoutePageFrame from '@/components/ui/organisms/RoutePageFrame.vue';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BoardControls from '@/components/BoardControls.vue';
import FacilityTable from '@/components/FacilityTable.vue';
import ContentListState from '@/components/ui/organisms/ContentListState.vue';
import { useFacilities } from '@/composables/useFacilities';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { useContentListRuntime } from '@/composables/useContentListRuntime';
import { normalizeSearchText } from '@/lib/search';
import type { FacilitySummary } from '@/types';
import { useI18n } from '@/i18n';
import { findFacilityCategory, getDefaultFacilityCategoryId, useCategories } from '@/composables/useCategories';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { activeFacilityCategories } = useCategories();
const routeCategory = Array.isArray(route.query.category) ? route.query.category[0] : route.query.category;
const category = ref(findFacilityCategory(routeCategory) ? routeCategory as string : getDefaultFacilityCategoryId());
const activeCategoryLabel = computed(() => findFacilityCategory(category.value)?.label ?? t('facility.facility'));
const categoryOptions = computed(() => activeFacilityCategories.value.map((entry) => ({
  label: entry.label,
  value: entry.id,
})));
const {
  affectingFacilityId,
  bucket,
  clearSearch,
  committedQuery,
  error,
  facilities,
  hasMore,
  load,
  loading,
  loadingMore,
  query,
  sort,
  submitSearch,
  toggleAffected,
} = useFacilities(category);
const { show } = useActionFeedback();
const facilityPanelKey = computed(() => [
  bucket.value,
  sort.value,
  committedQuery.value.trim(),
].join(':'));
const {
  isOnline: facilityOnline,
  loadMoreSentinel,
  loadingHasProblem: facilityLoadingHasProblem,
  problemDescription: facilityProblemDescription,
  problemTitle: facilityProblemTitle,
  retry: retryFacilities,
  visibleLoading: visibleFacilityLoading,
} = useContentListRuntime({
  error,
  hasMore,
  loadMore: () => load(true),
  loading,
  loadingMore,
  refresh: () => load(),
});
const searchHint = computed(() => {
  const draft = normalizeSearchText(query.value);
  const committed = normalizeSearchText(committedQuery.value);
  if (draft !== committed) return t('issue.search.pressEnterToSearch');
  if (!committed) return t('issue.search.enterTheKeywordAndPressEnterToSearch');
  if (committed.length < 3) return t('facility.search.loadedOnlyHint');
  return t('facility.searchForQuery', { query: committedQuery.value });
});
const emptyDescription = computed(() => committedQuery.value.trim()
  ? t('facility.noFacilityReportsMatchQuery', { query: committedQuery.value.trim() })
  : t('facility.noFacilityReportsInStatus', { status: t(bucket.value === 'closed' ? 'facility.caseClosed' : 'facility.processing') }));

watch(category, (value) => {
  if (!findFacilityCategory(value)) {
    category.value = getDefaultFacilityCategoryId();
    return;
  }
  const current = Array.isArray(route.query.category) ? route.query.category[0] : route.query.category;
  if (current === value) return;
  void router.replace({ query: { ...route.query, category: value } });
});
watch(() => route.query.category, (value) => {
  const requested = Array.isArray(value) ? value[0] : value;
  if (requested && findFacilityCategory(requested) && requested !== category.value) {
    category.value = requested;
  }
});

function openDetails(facility: FacilitySummary) {
  void router.push({
    name: 'facility-detail',
    params: { facilityId: facility.id },
    query: { ...route.query, category: category.value },
  });
}

function openComposer() {
  void router.push({ name: 'facility-create', query: { category: category.value } });
}

async function handleToggleAffected(facility: FacilitySummary) {
  try {
    await toggleAffected(facility);
  } catch (caught) {
    show(caught instanceof Error ? t(caught.message) : t('facility.theOperationFailedPleaseTryAgainLater'), 'error');
  }
}

</script>
