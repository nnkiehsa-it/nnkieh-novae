<template>
  <RoutePageFrame padding="responsive">
    <div class="mx-auto w-full max-w-4xl space-y-6 py-4">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.16em] text-primary-600">{{ t('categoryAdmin.settingsEyebrow') }}</p>
        <h1 class="mt-2 text-2xl font-bold text-ink-950 dark:text-ink-50">{{ t('categoryAdmin.managementTitle') }}</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-ink-500">{{ t('categoryAdmin.managementDescription') }}</p>
      </div>

      <SurfacePanel variant="inset" padding="md">
        <p class="text-sm font-semibold text-ink-900 dark:text-ink-100">{{ t('categoryAdmin.policyNoticeTitle') }}</p>
        <p class="mt-1 text-xs leading-5 text-ink-500">{{ t('categoryAdmin.policyNoticeDescription') }}</p>
      </SurfacePanel>

      <EmptyStatePanel v-if="error" title="categoryAdmin.loadFailed" :description="error" icon="warning" />
      <div v-if="loading" class="space-y-3">
        <SurfacePanel v-for="index in 3" :key="index" padding="lg"><SkeletonBlock class="h-32 w-full rounded-xl" /></SurfacePanel>
      </div>

      <template v-else>
        <CategoryManagementSection
          v-model="issueCategories"
          kind="issue"
          :title="t('categoryAdmin.proposalCategories')"
          :description="t('categoryAdmin.proposalManagementHelp')"
          :on-save="saveIssue"
          @add="addIssue"
        />
        <CategoryManagementSection
          v-model="facilityCategories"
          kind="facility"
          :title="t('categoryAdmin.facilityCategories')"
          :description="t('categoryAdmin.facilityManagementHelp')"
          :on-save="saveFacility"
          @add="addFacility"
        />
      </template>
    </div>
  </RoutePageFrame>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import CategoryManagementSection from '@/components/categories/CategoryManagementSection.vue';
import SkeletonBlock from '@/components/ui/atoms/SkeletonBlock.vue';
import EmptyStatePanel from '@/components/ui/molecules/EmptyStatePanel.vue';
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';
import RoutePageFrame from '@/components/ui/organisms/RoutePageFrame.vue';
import { useCategories } from '@/composables/useCategories';
import { useI18n } from '@/i18n';
import { getCategoryManagement, saveFacilityCategory, saveIssueCategory } from '@/services/categories';
import type { FacilityCategoryConfig, IssueCategoryConfig } from '@/types/categories';

const { t } = useI18n();
const { refresh } = useCategories();
const loading = ref(true);
const error = ref('');
const issueCategories = ref<IssueCategoryConfig[]>([]);
const facilityCategories = ref<FacilityCategoryConfig[]>([]);

function newIssue(index: number): IssueCategoryConfig {
  return { id: '', label: '', description: '', readAccess: 'school', authorVisible: true, supportEnabled: false,
    supportGoal: null, supportDeadlineDays: null, responseDeadlineDays: null, commentsEnabled: true,
    isActive: true, isDefault: issueCategories.value.length === 0, sortOrder: index };
}
function newFacility(index: number): FacilityCategoryConfig {
  return { id: '', label: '', description: '', isActive: true, isDefault: facilityCategories.value.length === 0, sortOrder: index };
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
  } catch (caught) {
    error.value = t(caught instanceof Error ? caught.message : 'common.loadFailed');
  } finally { loading.value = false; }
}

async function saveIssue(index: number) {
  issueCategories.value[index] = await saveIssueCategory({ ...issueCategories.value[index], sortOrder: index });
  await refresh();
}
async function saveFacility(index: number) {
  facilityCategories.value[index] = await saveFacilityCategory({ ...facilityCategories.value[index], sortOrder: index });
  await refresh();
}
onMounted(() => { void load(); });
</script>
