<template>
  <RoutePageFrame padding="responsive">
    <div class="mx-auto w-full max-w-4xl py-4">
      <div v-if="!languageConfirmed" class="mx-auto max-w-2xl space-y-5">
        <div class="text-center">
          <p class="text-xs font-bold uppercase tracking-[0.16em] text-primary-600">{{ t('categoryAdmin.setupStepLanguage') }}</p>
          <h1 class="mt-2 text-2xl font-bold text-ink-950 dark:text-ink-50">{{ t('categoryAdmin.chooseLanguageTitle') }}</h1>
          <p class="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink-500">{{ t('categoryAdmin.chooseLanguageDescription') }}</p>
        </div>
        <SurfacePanel variant="list">
          <LanguageSelector />
        </SurfacePanel>
        <div class="flex justify-end">
          <AppButton type="button" variant="primary" @click="languageConfirmed = true">
            {{ t('categoryAdmin.continueSetup') }}
          </AppButton>
        </div>
      </div>

      <SurfacePanel v-else-if="!isAdmin" padding="lg" class="text-center">
        <AppIcon name="refresh" :size="8" class="mx-auto text-ink-400" />
        <h1 class="mt-4 text-xl font-bold text-ink-950 dark:text-ink-50">{{ t('categoryAdmin.setupWaitingTitle') }}</h1>
        <p class="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink-500">{{ t('categoryAdmin.setupWaitingDescription') }}</p>
      </SurfacePanel>

      <form v-else class="space-y-5" @submit.prevent="submitSetup">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.16em] text-primary-600">{{ t('categoryAdmin.initialSetup') }}</p>
          <h1 class="mt-2 text-2xl font-bold text-ink-950 dark:text-ink-50">{{ t('categoryAdmin.setupTitle') }}</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-ink-500">{{ t('categoryAdmin.setupDescription') }}</p>
        </div>

        <section class="space-y-3" aria-labelledby="setup-features-title">
          <div>
            <h2 id="setup-features-title" class="text-lg font-bold text-ink-950 dark:text-ink-50">{{ t('categoryAdmin.setupStepFeatures') }}</h2>
            <p class="mt-1 text-sm leading-6 text-ink-500">{{ t('categoryAdmin.setupFeatureDescription') }}</p>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <PlatformFeatureToggle
              label="categoryAdmin.proposalFeature"
              description="categoryAdmin.proposalFeatureHelp"
              :enabled="issuesEnabled"
              @toggle="toggleFeature('issue')"
            />
            <PlatformFeatureToggle
              label="categoryAdmin.facilityFeature"
              description="categoryAdmin.facilityFeatureHelp"
              :enabled="facilitiesEnabled"
              @toggle="toggleFeature('facility')"
            />
          </div>
        </section>

        <section class="space-y-3" aria-labelledby="setup-categories-title">
          <div>
            <h2 id="setup-categories-title" class="text-lg font-bold text-ink-950 dark:text-ink-50">{{ t('categoryAdmin.setupStepCategories') }}</h2>
            <p class="mt-1 text-sm leading-6 text-ink-500">{{ t('categoryAdmin.setupCategoriesDescription') }}</p>
          </div>

          <div v-if="kindOptions.length > 1" class="grid gap-3 sm:grid-cols-2" role="group" :aria-label="t('categoryAdmin.setupStepCategories')">
            <SelectionOptionButton
              v-for="option in kindOptions"
              :key="option.value"
              :label="option.label"
              :description="option.description"
              :selected="activeCategoryKind === option.value"
              @select="activeCategoryKind = option.value"
            />
          </div>

          <SetupCategorySection
            v-if="issuesEnabled && activeCategoryKind === 'issue'"
            v-model="issueCategories"
            kind="issue"
            :title="t('categoryAdmin.proposalCategories')"
            :description="t('categoryAdmin.proposalSetupHelp')"
            @add="addIssueCategory"
          />
          <SetupCategorySection
            v-else-if="facilitiesEnabled && activeCategoryKind === 'facility'"
            v-model="facilityCategories"
            kind="facility"
            :title="t('categoryAdmin.facilityCategories')"
            :description="t('categoryAdmin.facilitySetupHelp')"
            @add="addFacilityCategory"
          />

          <SurfacePanel v-else padding="lg" class="text-center text-sm leading-6 text-ink-500">
            {{ t('categoryAdmin.noFeaturesEnabled') }}
          </SurfacePanel>
        </section>

        <InlineMessage v-if="error">{{ error }}</InlineMessage>
        <p v-else-if="!isSetupValid" class="text-right text-sm font-medium text-ink-500">
          {{ t('categoryAdmin.setupIncomplete') }}
        </p>
        <div class="flex justify-end">
          <AppButton type="submit" variant="primary" :disabled="saving || !isSetupValid">
            <BusyButtonContent :busy="saving" :label="t('categoryAdmin.completeSetup')" :busy-label="t('categoryAdmin.completingSetup')" />
          </AppButton>
        </div>
      </form>
    </div>
  </RoutePageFrame>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import LanguageSelector from '@/components/LanguageSelector.vue';
import PlatformFeatureToggle from '@/components/categories/PlatformFeatureToggle.vue';
import SetupCategorySection from '@/components/categories/SetupCategorySection.vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import BusyButtonContent from '@/components/ui/atoms/BusyButtonContent.vue';
import InlineMessage from '@/components/ui/atoms/InlineMessage.vue';
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';
import SelectionOptionButton from '@/components/ui/molecules/SelectionOptionButton.vue';
import RoutePageFrame from '@/components/ui/organisms/RoutePageFrame.vue';
import { useCategories } from '@/composables/useCategories';
import { useSession } from '@/composables/useSession';
import { useI18n } from '@/i18n';
import { completeInitialSetup } from '@/services/categories';
import type { FacilityCategoryDraft, IssueCategoryDraft } from '@/types/categories';
import { getDefaultAuthenticatedRoute } from '@/router/default-route';

const router = useRouter();
const SETUP_STATUS_REFRESH_INTERVAL_MS = 3_000;
const { t } = useI18n();
const { isAdmin, refreshSessionAccess, setupCompleted } = useSession();
const { refresh } = useCategories();
const saving = ref(false);
const error = ref('');
const languageConfirmed = ref(false);
const activeCategoryKind = ref<'issue' | 'facility'>('issue');
const issuesEnabled = ref(true);
const facilitiesEnabled = ref(true);
let setupRefreshInFlight = false;
let setupRefreshTimer: number | null = null;
const kindOptions = computed(() => [
  issuesEnabled.value
    ? { value: 'issue' as const, label: t('categoryAdmin.proposalCategories'), description: t('categoryAdmin.proposalSetupHelp') }
    : null,
  facilitiesEnabled.value
    ? { value: 'facility' as const, label: t('categoryAdmin.facilityCategories'), description: t('categoryAdmin.facilitySetupHelp') }
    : null,
].filter((option): option is NonNullable<typeof option> => option !== null));

function newIssueCategory(): IssueCategoryDraft {
  return {
    id: '', label: '', readAccess: '', authorVisible: null,
    supportEnabled: false, supportGoal: null, supportDeadlineDays: null,
    responseDeadlineDays: null, commentsEnabled: true,
  };
}
function newFacilityCategory(): FacilityCategoryDraft { return { id: '', label: '' }; }
const issueCategories = ref<IssueCategoryDraft[]>([newIssueCategory()]);
const facilityCategories = ref<FacilityCategoryDraft[]>([newFacilityCategory()]);
function addIssueCategory() { issueCategories.value.push(newIssueCategory()); }
function addFacilityCategory() { facilityCategories.value.push(newFacilityCategory()); }

const CATEGORY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function hasUniqueValidIdentities(categories: Array<{ id: string; label: string }>) {
  const ids = categories.map((category) => category.id.trim());
  return categories.length > 0
    && new Set(ids).size === ids.length
    && categories.every((category) => CATEGORY_ID_PATTERN.test(category.id.trim()) && category.label.trim().length > 0);
}

function isPositiveIntegerOrNull(value: number | null) {
  return value === null || (Number.isInteger(value) && value > 0);
}

const issueSetupValid = computed(() => hasUniqueValidIdentities(issueCategories.value)
  && issueCategories.value.every((category) => Boolean(category.readAccess)
    && typeof category.authorVisible === 'boolean'
    && isPositiveIntegerOrNull(category.responseDeadlineDays)
    && (!category.supportEnabled || (
      isPositiveIntegerOrNull(category.supportGoal) && category.supportGoal !== null
      && isPositiveIntegerOrNull(category.supportDeadlineDays) && category.supportDeadlineDays !== null
    ))));
const facilitySetupValid = computed(() => hasUniqueValidIdentities(facilityCategories.value));
const isSetupValid = computed(() => (!issuesEnabled.value || issueSetupValid.value)
  && (!facilitiesEnabled.value || facilitySetupValid.value));

function toggleFeature(kind: 'facility' | 'issue') {
  if (kind === 'issue') issuesEnabled.value = !issuesEnabled.value;
  else facilitiesEnabled.value = !facilitiesEnabled.value;
  if (issuesEnabled.value && !facilitiesEnabled.value) activeCategoryKind.value = 'issue';
  if (facilitiesEnabled.value && !issuesEnabled.value) activeCategoryKind.value = 'facility';
}

async function continueToPlatform() {
  await refresh();
  await router.replace(getDefaultAuthenticatedRoute());
}

async function refreshWaitingSetupStatus() {
  if (isAdmin.value || setupCompleted.value || setupRefreshInFlight) return;
  setupRefreshInFlight = true;
  try {
    await refreshSessionAccess();
    if (setupCompleted.value) await continueToPlatform();
  } catch {
    // Keep the waiting screen usable; the next interval or visibility change retries.
  } finally {
    setupRefreshInFlight = false;
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') void refreshWaitingSetupStatus();
}

onMounted(() => {
  if (isAdmin.value || setupCompleted.value) return;
  void refreshWaitingSetupStatus();
  setupRefreshTimer = window.setInterval(
    () => void refreshWaitingSetupStatus(),
    SETUP_STATUS_REFRESH_INTERVAL_MS,
  );
  document.addEventListener('visibilitychange', handleVisibilityChange);
});

onBeforeUnmount(() => {
  if (setupRefreshTimer !== null) window.clearInterval(setupRefreshTimer);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});

async function submitSetup() {
  if (!isSetupValid.value) return;
  saving.value = true;
  error.value = '';
  try {
    await completeInitialSetup({
      facilitiesEnabled: facilitiesEnabled.value,
      facilityCategories: facilitiesEnabled.value ? facilityCategories.value : [],
      issuesEnabled: issuesEnabled.value,
      issueCategories: issuesEnabled.value ? issueCategories.value : [],
    });
    await refreshSessionAccess();
    await continueToPlatform();
  } catch (caught) {
    try {
      await refreshSessionAccess();
      if (setupCompleted.value) {
        await continueToPlatform();
        return;
      }
    } catch {
      // Preserve the original setup failure when the completion state cannot be confirmed.
    }
    error.value = t(caught instanceof Error ? caught.message : 'common.saveFailed');
  } finally {
    saving.value = false;
  }
}
</script>
