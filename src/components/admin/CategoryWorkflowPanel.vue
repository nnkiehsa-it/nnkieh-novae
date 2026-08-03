<template>
  <section class="space-y-5" aria-labelledby="category-workflow-title">
    <h2 id="category-workflow-title" class="sr-only">{{ t('adminCenter.categorySectionTitle') }}</h2>

    <div class="pb-1">
      <PillSegmentedControl
        v-model="activeCategoryKind"
        layout="equal"
        :options="kindOptions"
      />
    </div>

    <EmptyStatePanel v-if="error" title="categoryAdmin.loadFailed" :description="error" icon="warning" />

    <div v-if="loading" class="space-y-3" aria-busy="true" :aria-label="t('common.loading')">
      <SurfacePanel padding="md" class="space-y-3">
        <SkeletonBlock class="block h-4 w-28 rounded" />
        <SkeletonBlock class="block h-3 w-2/3 rounded" />
        <SkeletonBlock class="h-14 w-full rounded-[var(--radius-inner)]" />
      </SurfacePanel>
      <div class="grid items-start gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <SurfacePanel variant="list" padding="sm" class="space-y-2">
          <SkeletonBlock class="block h-3 w-20 rounded" />
          <div
            v-for="index in 3"
            :key="index"
            class="skeleton-enter flex items-center gap-3 rounded-[var(--radius-inner)] px-3 py-3"
            :style="{ '--skeleton-enter-index': index - 1 }"
          >
            <div class="min-w-0 flex-1 space-y-2">
              <SkeletonBlock class="block h-4 w-24 rounded" />
              <SkeletonBlock class="block h-3 w-16 rounded" />
            </div>
            <SkeletonBlock class="h-3 w-10 rounded" />
          </div>
        </SurfacePanel>
        <SurfacePanel padding="lg" class="space-y-4">
          <SkeletonBlock class="block h-3 w-16 rounded" />
          <SkeletonBlock class="block h-5 w-40 rounded" />
          <SkeletonBlock class="block h-10 w-full rounded-xl" />
          <SkeletonBlock class="block h-10 w-full rounded-xl" />
          <SkeletonBlock class="block h-24 w-full rounded-xl" />
        </SurfacePanel>
      </div>
    </div>

    <template v-else>
      <CategoryManagementSection
        v-if="activeCategoryKind === 'issue'"
        v-model="issueCategories"
        kind="issue"
        :disabled="!issuesEnabled"
        :title="t('categoryAdmin.proposalCategories')"
        :description="t('categoryAdmin.proposalManagementHelp')"
        :on-delete="deleteIssue"
        :persisted-ids="persistedIssueIds"
      >
        <template #header-actions>
          <PlatformFeatureToggle
            compact
            :label="activeFeatureToggle.label"
            :description="activeFeatureToggle.description"
            :enabled="activeFeatureToggle.enabled"
            :disabled="saving"
            @toggle="toggleFeature('issue')"
          />
        </template>
      </CategoryManagementSection>
      <CategoryManagementSection
        v-else-if="activeCategoryKind === 'facility'"
        v-model="facilityCategories"
        kind="facility"
        :disabled="!facilitiesEnabled"
        :title="t('categoryAdmin.facilityCategories')"
        :description="t('categoryAdmin.facilityManagementHelp')"
        :on-delete="deleteFacility"
        :persisted-ids="persistedFacilityIds"
      >
        <template #header-actions>
          <PlatformFeatureToggle
            compact
            :label="activeFeatureToggle.label"
            :description="activeFeatureToggle.description"
            :enabled="activeFeatureToggle.enabled"
            :disabled="saving"
            @toggle="toggleFeature('facility')"
          />
        </template>
      </CategoryManagementSection>
      <section v-else class="space-y-4" aria-labelledby="announcement-comments-setting-title">
        <div class="space-y-1">
          <h3 id="announcement-comments-setting-title" class="text-base font-bold text-ink-950 dark:text-ink-50">
            {{ t('adminCenter.announcementComments') }}
          </h3>
          <p class="text-sm leading-6 text-ink-500">{{ t('adminCenter.announcementCommentsHelp') }}</p>
        </div>
        <PlatformFeatureToggle
          :label="activeFeatureToggle.label"
          :description="activeFeatureToggle.description"
          :enabled="activeFeatureToggle.enabled"
          :disabled="saving"
          @toggle="toggleFeature('announcement')"
        />
      </section>
      <InlineMessage v-if="featureError">{{ featureError }}</InlineMessage>
    </template>

    <div v-if="!loading" class="flex flex-col items-stretch gap-3 border-t border-ink-100 pt-4 dark:border-ink-800 sm:flex-row sm:items-center sm:justify-end">
      <InlineMessage v-if="saveError" class="min-w-0 flex-1">{{ saveError }}</InlineMessage>
      <AppButton variant="primary" :disabled="saving" @click="saveAll">
        <BusyButtonContent :busy="saving" :label="t('categoryAdmin.saveAllChanges')" :busy-label="t('common.saving')" />
      </AppButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import CategoryManagementSection from '@/components/categories/CategoryManagementSection.vue';
import PlatformFeatureToggle from '@/components/categories/PlatformFeatureToggle.vue';
import InlineMessage from '@/components/ui/atoms/InlineMessage.vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import BusyButtonContent from '@/components/ui/atoms/BusyButtonContent.vue';
import SkeletonBlock from '@/components/ui/atoms/SkeletonBlock.vue';
import EmptyStatePanel from '@/components/ui/molecules/EmptyStatePanel.vue';
import PillSegmentedControl, { type PillSegmentedControlOption } from '@/components/ui/molecules/PillSegmentedControl.vue';
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';
import { useCategories } from '@/composables/useCategories';
import { useI18n } from '@/i18n';
import {
  getCategoryManagement,
  saveCategoryManagement,
} from '@/services/categories';
import type { FacilityCategoryConfig, IssueCategoryConfig } from '@/types/categories';

const { t } = useI18n();
const { refresh } = useCategories();
const loading = ref(true);
const error = ref('');
const issueCategories = ref<IssueCategoryConfig[]>([]);
const facilityCategories = ref<FacilityCategoryConfig[]>([]);
const persistedIssueIds = ref<ReadonlySet<string>>(new Set());
const persistedFacilityIds = ref<ReadonlySet<string>>(new Set());
const deletedIssueCategoryIds = ref<string[]>([]);
const deletedFacilityCategoryIds = ref<string[]>([]);
const activeCategoryKind = ref<'announcement' | 'issue' | 'facility'>('issue');
const announcementCommentsEnabled = ref(true);
const issuesEnabled = ref(true);
const facilitiesEnabled = ref(true);
const featureError = ref('');
const saving = ref(false);
const saveError = ref('');

const kindOptions = computed<readonly PillSegmentedControlOption<'announcement' | 'issue' | 'facility'>[]>(() => [
  { value: 'issue', label: t('adminCenter.proposalTab'), icon: 'comment' },
  { value: 'facility', label: t('adminCenter.facilityTab'), icon: 'wrench' },
  { value: 'announcement', label: t('adminCenter.announcementTab'), icon: 'megaphone' },
]);

const activeFeatureToggle = computed(() => {
  if (activeCategoryKind.value === 'issue') return {
    description: 'categoryAdmin.proposalFeatureHelp',
    enabled: issuesEnabled.value,
    label: 'categoryAdmin.proposalFeature',
  };
  if (activeCategoryKind.value === 'facility') return {
    description: 'categoryAdmin.facilityFeatureHelp',
    enabled: facilitiesEnabled.value,
    label: 'categoryAdmin.facilityFeature',
  };
  return {
    description: 'adminCenter.announcementCommentsFeatureHelp',
    enabled: announcementCommentsEnabled.value,
    label: 'adminCenter.announcementCommentsFeature',
  };
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const result = await getCategoryManagement();
    issueCategories.value = result.issueCategories;
    facilityCategories.value = result.facilityCategories;
    persistedIssueIds.value = new Set(result.issueCategories.map((category) => category.id));
    persistedFacilityIds.value = new Set(result.facilityCategories.map((category) => category.id));
    deletedIssueCategoryIds.value = [];
    deletedFacilityCategoryIds.value = [];
    issuesEnabled.value = result.features.issuesEnabled;
    facilitiesEnabled.value = result.features.facilitiesEnabled;
    announcementCommentsEnabled.value = result.features.announcementCommentsEnabled;
  } catch (caught) {
    error.value = t(caught instanceof Error ? caught.message : 'common.loadFailed');
  } finally {
    loading.value = false;
  }
}

function toggleFeature(kind: 'announcement' | 'facility' | 'issue') {
  if (loading.value || saving.value) return;
  featureError.value = '';
  if (kind === 'announcement') announcementCommentsEnabled.value = !announcementCommentsEnabled.value;
  else if (kind === 'facility') facilitiesEnabled.value = !facilitiesEnabled.value;
  else issuesEnabled.value = !issuesEnabled.value;
}

async function saveAll() {
  if (saving.value) return;
  saving.value = true;
  saveError.value = '';
  try {
    const result = await saveCategoryManagement({
      announcementCommentsEnabled: announcementCommentsEnabled.value,
      deletedFacilityCategoryIds: deletedFacilityCategoryIds.value,
      deletedIssueCategoryIds: deletedIssueCategoryIds.value,
      facilitiesEnabled: facilitiesEnabled.value,
      facilityCategories: facilityCategories.value.map((category, sortOrder) => ({ ...category, sortOrder })),
      issueCategories: issueCategories.value.map((category, sortOrder) => ({ ...category, sortOrder })),
      issuesEnabled: issuesEnabled.value,
    });
    facilityCategories.value = result.facilityCategories;
    issueCategories.value = result.issueCategories;
    facilitiesEnabled.value = result.features.facilitiesEnabled;
    issuesEnabled.value = result.features.issuesEnabled;
    announcementCommentsEnabled.value = result.features.announcementCommentsEnabled;
    persistedIssueIds.value = new Set(result.issueCategories.map((category) => category.id));
    persistedFacilityIds.value = new Set(result.facilityCategories.map((category) => category.id));
    deletedIssueCategoryIds.value = [];
    deletedFacilityCategoryIds.value = [];
    await refresh();
  } catch (caught) {
    saveError.value = t(caught instanceof Error ? caught.message : 'common.saveFailed');
  } finally {
    saving.value = false;
  }
}

async function deleteIssue(index: number) {
  const category = issueCategories.value[index];
  if (category.id && persistedIssueIds.value.has(category.id)) {
    deletedIssueCategoryIds.value.push(category.id);
  }
  issueCategories.value.splice(index, 1);
}

async function deleteFacility(index: number) {
  const category = facilityCategories.value[index];
  if (category.id && persistedFacilityIds.value.has(category.id)) {
    deletedFacilityCategoryIds.value.push(category.id);
  }
  facilityCategories.value.splice(index, 1);
}

onMounted(() => { void load(); });
</script>
