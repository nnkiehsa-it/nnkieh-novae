<template>
  <section class="space-y-5" aria-labelledby="category-workflow-title">
    <h2 id="category-workflow-title" class="sr-only">{{ t('adminCenter.categorySectionTitle') }}</h2>

    <section class="space-y-3" aria-labelledby="platform-features-title">
      <div>
        <h3 id="platform-features-title" class="text-lg font-bold text-ink-950 dark:text-ink-50">{{ t('categoryAdmin.featureSettings') }}</h3>
        <p class="mt-1 text-sm leading-6 text-ink-500">{{ t('categoryAdmin.featureSettingsHelp') }}</p>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <PlatformFeatureToggle
          label="categoryAdmin.proposalFeature"
          description="categoryAdmin.proposalFeatureHelp"
          :enabled="issuesEnabled"
          :disabled="loading || savingFeatures"
          @toggle="toggleFeature('issue')"
        />
        <PlatformFeatureToggle
          label="categoryAdmin.facilityFeature"
          description="categoryAdmin.facilityFeatureHelp"
          :enabled="facilitiesEnabled"
          :disabled="loading || savingFeatures"
          @toggle="toggleFeature('facility')"
        />
      </div>
      <InlineMessage v-if="featureError">{{ featureError }}</InlineMessage>
    </section>

    <div class="grid gap-3 pb-1 sm:grid-cols-2" role="group" :aria-label="t('adminCenter.categorySectionTitle')">
      <SelectionOptionButton
        v-for="option in kindOptions"
        :key="option.value"
        :label="option.label"
        :description="option.description"
        :selected="activeCategoryKind === option.value"
        @select="activeCategoryKind = option.value"
      />
    </div>

    <EmptyStatePanel v-if="error" title="categoryAdmin.loadFailed" :description="error" icon="warning" />
    <div v-if="loading" class="space-y-3">
      <SurfacePanel v-for="index in 2" :key="index" padding="lg">
        <SkeletonBlock class="h-44 w-full rounded-xl" />
      </SurfacePanel>
    </div>

    <template v-else>
      <CategoryManagementSection
        v-if="activeCategoryKind === 'issue'"
        v-model="issueCategories"
        kind="issue"
        :title="t('categoryAdmin.proposalCategories')"
        :description="t('categoryAdmin.proposalManagementHelp')"
        :on-save="saveIssue"
        :on-delete="deleteIssue"
        @add="addIssue"
      />
      <CategoryManagementSection
        v-else-if="activeCategoryKind === 'facility'"
        v-model="facilityCategories"
        kind="facility"
        :title="t('categoryAdmin.facilityCategories')"
        :description="t('categoryAdmin.facilityManagementHelp')"
        :on-save="saveFacility"
        :on-delete="deleteFacility"
        @add="addFacility"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import CategoryManagementSection from '@/components/categories/CategoryManagementSection.vue';
import PlatformFeatureToggle from '@/components/categories/PlatformFeatureToggle.vue';
import InlineMessage from '@/components/ui/atoms/InlineMessage.vue';
import SkeletonBlock from '@/components/ui/atoms/SkeletonBlock.vue';
import EmptyStatePanel from '@/components/ui/molecules/EmptyStatePanel.vue';
import SelectionOptionButton from '@/components/ui/molecules/SelectionOptionButton.vue';
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';
import { useCategories } from '@/composables/useCategories';
import { useI18n } from '@/i18n';
import {
  deleteCategory,
  getCategoryManagement,
  saveFacilityCategory,
  saveIssueCategory,
  savePlatformFeatures,
} from '@/services/categories';
import type { FacilityCategoryConfig, IssueCategoryConfig } from '@/types/categories';

const { t } = useI18n();
const { refresh } = useCategories();
const loading = ref(true);
const error = ref('');
const issueCategories = ref<IssueCategoryConfig[]>([]);
const facilityCategories = ref<FacilityCategoryConfig[]>([]);
const activeCategoryKind = ref<'issue' | 'facility'>('issue');
const issuesEnabled = ref(true);
const facilitiesEnabled = ref(true);
const savingFeatures = ref(false);
const featureError = ref('');

const kindOptions = computed(() => [
  { value: 'issue' as const, label: t('categoryAdmin.proposalCategories'), description: t('categoryAdmin.proposalManagementHelp') },
  { value: 'facility' as const, label: t('categoryAdmin.facilityCategories'), description: t('categoryAdmin.facilityManagementHelp') },
]);

function newIssue(index: number): IssueCategoryConfig {
  return {
    id: '', label: '', readAccess: 'school', authorVisible: true,
    supportEnabled: false, supportGoal: null, supportDeadlineDays: null,
    responseDeadlineDays: null, commentsEnabled: true, isActive: true,
    isDefault: issueCategories.value.length === 0, sortOrder: index,
  };
}

function newFacility(index: number): FacilityCategoryConfig {
  return {
    id: '', label: '', isActive: true,
    isDefault: facilityCategories.value.length === 0, sortOrder: index,
  };
}

function addIssue() { issueCategories.value.push(newIssue(issueCategories.value.length)); }
function addFacility() { facilityCategories.value.push(newFacility(facilityCategories.value.length)); }

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const result = await getCategoryManagement();
    issueCategories.value = result.issueCategories;
    facilityCategories.value = result.facilityCategories;
    issuesEnabled.value = result.features.issuesEnabled;
    facilitiesEnabled.value = result.features.facilitiesEnabled;
  } catch (caught) {
    error.value = t(caught instanceof Error ? caught.message : 'common.loadFailed');
  } finally {
    loading.value = false;
  }
}

async function toggleFeature(kind: 'facility' | 'issue') {
  if (loading.value || savingFeatures.value) return;
  savingFeatures.value = true;
  featureError.value = '';
  try {
    const next = {
      facilitiesEnabled: kind === 'facility' ? !facilitiesEnabled.value : facilitiesEnabled.value,
      issuesEnabled: kind === 'issue' ? !issuesEnabled.value : issuesEnabled.value,
    };
    const result = await savePlatformFeatures(next);
    facilitiesEnabled.value = result.facilitiesEnabled;
    issuesEnabled.value = result.issuesEnabled;
    await refresh();
  } catch (caught) {
    featureError.value = t(caught instanceof Error ? caught.message : 'common.saveFailed');
  } finally {
    savingFeatures.value = false;
  }
}

async function saveIssue(index: number) {
  issueCategories.value[index] = await saveIssueCategory({ ...issueCategories.value[index], sortOrder: index });
  await refresh();
}

async function saveFacility(index: number) {
  facilityCategories.value[index] = await saveFacilityCategory({ ...facilityCategories.value[index], sortOrder: index });
  await refresh();
}

async function deleteIssue(index: number) {
  const category = issueCategories.value[index];
  if (category.id) {
    await deleteCategory({ kind: 'issue', id: category.id });
  }
  issueCategories.value.splice(index, 1);
  await refresh();
}

async function deleteFacility(index: number) {
  const category = facilityCategories.value[index];
  if (category.id) {
    await deleteCategory({ kind: 'facility', id: category.id });
  }
  facilityCategories.value.splice(index, 1);
  await refresh();
}

onMounted(() => { void load(); });
</script>
