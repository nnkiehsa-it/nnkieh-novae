<template>
  <component
    :is="flat ? 'article' : SurfacePanel"
    :as="flat ? undefined : 'article'"
    :padding="flat ? undefined : 'lg'"
    class="space-y-5"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs font-semibold uppercase tracking-wide text-ink-500">{{ kindLabel }}</p>
        <h3 class="mt-1 truncate text-base font-bold text-ink-950 dark:text-ink-50">
          {{ draft.label || t('categoryAdmin.untitledCategory') }}
        </h3>
      </div>
      <AppButton v-if="removable" variant="toolbar" class="h-9 w-9 shrink-0 p-0" :aria-label="t('categoryAdmin.removeCategory')" @click="emit('remove')">
        <AppIcon name="trash" :size="4" />
      </AppButton>
    </div>

    <!-- Segmented control for switching views (only for issue categories) -->
    <div v-if="kind === 'issue'" class="flex border-b border-ink-100 pb-3 dark:border-ink-800">
      <PillSegmentedControl
        v-model="activeTab"
        :options="tabOptions"
      />
    </div>

    <!-- Basic settings group -->
    <div v-show="kind !== 'issue' || activeTab === 'basic'" class="space-y-5">
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <label :for="`${fieldId}-label`" class="field-label">{{ t('categoryAdmin.categoryName') }}</label>
          <input :id="`${fieldId}-label`" v-model="draft.label" class="field mt-1.5" maxlength="40" required />
        </div>
        <div>
          <label :for="`${fieldId}-id`" class="field-label">{{ t('categoryAdmin.categoryId') }}</label>
          <input
            :id="`${fieldId}-id`"
            v-model="draft.id"
            class="field mt-1.5"
            maxlength="48"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            :disabled="idLocked"
            required
          />
          <p class="mt-1 text-xs leading-5 text-ink-500">{{ t(idLocked ? 'categoryAdmin.idLockedHelp' : 'categoryAdmin.idHelp') }}</p>
        </div>
      </div>

      <SurfacePanel v-if="defaultDraft" variant="inset" class="overflow-hidden">
        <ListSurfaceRow
          interactive
          role="switch"
          :aria-checked="defaultDraft.isDefault"
          :aria-disabled="defaultDraft.isDefault || undefined"
          :disabled="defaultDraft.isDefault || undefined"
          :class="defaultDraft.isDefault ? 'cursor-default' : ''"
          @click="makeDefault"
        >
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-semibold text-ink-900 dark:text-ink-100">{{ t('categoryAdmin.defaultCategory') }}</span>
            <span class="mt-0.5 block text-xs leading-5 text-ink-500">{{ t('adminCenter.defaultCategoryHelp') }}</span>
          </span>
          <SwitchIndicator :checked="defaultDraft.isDefault" />
        </ListSurfaceRow>
      </SurfacePanel>
    </div>

    <!-- Advanced rules group -->
    <div v-show="kind === 'issue' && activeTab === 'workflow'" class="space-y-5">
      <template v-if="issueDraft">
        <div>
          <div class="mb-2 flex items-center justify-between gap-3">
            <p class="field-label">{{ t('categoryAdmin.readAccess') }}</p>
            <span v-if="privacyLocked" class="text-xs font-semibold text-ink-500">{{ t('categoryAdmin.permanentlyLocked') }}</span>
          </div>
          <div class="grid gap-2">
            <SelectionOptionButton
              v-for="option in readAccessOptions"
              :key="option.value"
              :label="option.label"
              :description="option.description"
              :selected="issueDraft.readAccess === option.value"
              :disabled="privacyLocked"
              @select="setReadAccess(option.value)"
            />
          </div>
        </div>

        <div>
          <p class="field-label mb-2">{{ t('categoryAdmin.authorVisibility') }}</p>
          <div class="grid gap-2 md:grid-cols-2">
            <SelectionOptionButton
              label="categoryAdmin.authorVisible"
              description="categoryAdmin.authorVisibleHelp"
              :selected="issueDraft.authorVisible === true"
              :disabled="privacyLocked"
              @select="setAuthorVisible(true)"
            />
            <SelectionOptionButton
              label="categoryAdmin.authorHidden"
              description="categoryAdmin.authorHiddenHelp"
              :selected="issueDraft.authorVisible === false"
              :disabled="privacyLocked || issueDraft.readAccess === 'owner-admin'"
              @select="setAuthorVisible(false)"
            />
          </div>
        </div>

        <div class="grid gap-2">
          <ListSurfaceRow
            interactive
            role="switch"
            :aria-checked="issueDraft.commentsEnabled"
            @click="issueDraft.commentsEnabled = !issueDraft.commentsEnabled"
          >
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-ink-900 dark:text-ink-100">{{ t('categoryAdmin.allowComments') }}</span>
              <span class="mt-0.5 block text-xs leading-5 text-ink-500">{{ t('categoryAdmin.commentsAvailabilityScope') }}</span>
            </span>
            <SwitchIndicator :checked="issueDraft.commentsEnabled" />
          </ListSurfaceRow>
          <ListSurfaceRow
            interactive
            role="switch"
            :aria-checked="issueDraft.supportEnabled === true"
            @click="toggleSupport"
          >
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-ink-900 dark:text-ink-100">{{ t('categoryAdmin.enableSupport') }}</span>
              <span class="mt-0.5 block text-xs leading-5 text-ink-500">{{ t('categoryAdmin.futureProposalsOnly') }}</span>
            </span>
            <SwitchIndicator :checked="issueDraft.supportEnabled === true" />
          </ListSurfaceRow>
        </div>

        <div v-if="issueDraft.supportEnabled" class="grid gap-4 md:grid-cols-3">
          <NumberField v-model="issueDraft.supportGoal" :input-id="`${fieldId}-goal`" label="categoryAdmin.supportGoal" />
          <NumberField v-model="issueDraft.supportDeadlineDays" :input-id="`${fieldId}-support-days`" label="categoryAdmin.supportDeadline" />
          <NumberField v-model="issueDraft.responseDeadlineDays" :input-id="`${fieldId}-response-days`" label="categoryAdmin.responseDeadline" :required="false" />
        </div>
        <NumberField
          v-else
          v-model="issueDraft.responseDeadlineDays"
          :input-id="`${fieldId}-response-days`"
          label="categoryAdmin.responseDeadline"
          :required="false"
        />
      </template>
    </div>

    <div v-if="deletable" class="flex flex-col gap-3 border-t border-ink-100 pt-4 dark:border-ink-800 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-xs leading-5 text-ink-500">
        {{ t(defaultDraft?.isDefault ? 'categoryAdmin.cannotDeleteDefaultCategoryHelp' : 'categoryAdmin.saveAllChangesHelp') }}
      </p>
      <AppButton
        variant="danger"
        class="shrink-0"
        :disabled="defaultDraft?.isDefault || deleting"
        @click="emit('delete')"
      >
        <BusyButtonContent :busy="deleting" :label="t('categoryAdmin.deleteCategory')" :busy-label="t('common.deleting')" />
      </AppButton>
    </div>
  </component>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import BusyButtonContent from '@/components/ui/atoms/BusyButtonContent.vue';
import SwitchIndicator from '@/components/ui/atoms/SwitchIndicator.vue';
import ListSurfaceRow from '@/components/ui/molecules/ListSurfaceRow.vue';
import NumberField from '@/components/ui/molecules/NumberField.vue';
import SelectionOptionButton from '@/components/ui/molecules/SelectionOptionButton.vue';
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';
import PillSegmentedControl from '@/components/ui/molecules/PillSegmentedControl.vue';
import type { PillSegmentedControlOption } from '@/components/ui/molecules/PillSegmentedControl.vue';
import { useI18n } from '@/i18n';
import type { FacilityCategoryDraft, IssueCategoryDraft, IssueReadAccess } from '@/types/categories';

const props = withDefaults(defineProps<{
  fieldId: string;
  deletable?: boolean;
  deleting?: boolean;
  defaultControl?: boolean;
  flat?: boolean;
  idLocked?: boolean;
  kind: 'facility' | 'issue';
  modelValue: FacilityCategoryDraft | IssueCategoryDraft;
  privacyLocked?: boolean;
  removable?: boolean;
}>(), { defaultControl: false, deletable: false, deleting: false, flat: false, idLocked: false, privacyLocked: false, removable: true });

const emit = defineEmits<{
  delete: [];
  makeDefault: [];
  remove: [];
  'update:modelValue': [value: FacilityCategoryDraft | IssueCategoryDraft];
}>();

const { t } = useI18n();

const activeTab = ref<'basic' | 'workflow'>('basic');

// Watch for category change to reset tab
watch(() => props.fieldId, () => {
  activeTab.value = 'basic';
});

const tabOptions = computed<readonly PillSegmentedControlOption<'basic' | 'workflow'>[]>(() => [
  { value: 'basic', label: t('categoryAdmin.stepBasicInfo'), icon: 'settings' },
  { value: 'workflow', label: t('categoryAdmin.stepWorkflowRules'), icon: 'shield-check' },
]);

const draft = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const issueDraft = computed(() => props.kind === 'issue' ? draft.value as IssueCategoryDraft : null);
const defaultDraft = computed(() => props.defaultControl
  ? draft.value as FacilityCategoryDraft | IssueCategoryDraft
  : null);
const kindLabel = computed(() => t(props.kind === 'issue' ? 'categoryAdmin.proposalCategory' : 'categoryAdmin.facilityCategory'));
const readAccessOptions: Array<{ value: IssueReadAccess; label: string; description: string }> = [
  { value: 'school', label: 'categoryAdmin.readSchool', description: 'categoryAdmin.readSchoolHelp' },
  { value: 'reviewed-school', label: 'categoryAdmin.readAfterReview', description: 'categoryAdmin.readAfterReviewHelp' },
  { value: 'owner-admin', label: 'categoryAdmin.readOwnerAdmin', description: 'categoryAdmin.readOwnerAdminHelp' },
];

function setReadAccess(value: IssueReadAccess) {
  if (!issueDraft.value || props.privacyLocked) return;
  issueDraft.value.readAccess = value;
  if (value === 'owner-admin') issueDraft.value.authorVisible = true;
}

function setAuthorVisible(value: boolean) {
  if (!issueDraft.value || props.privacyLocked) return;
  issueDraft.value.authorVisible = value;
}

function toggleSupport() {
  if (!issueDraft.value) return;
  issueDraft.value.supportEnabled = !issueDraft.value.supportEnabled;
  if (!issueDraft.value.supportEnabled) {
    issueDraft.value.supportGoal = null;
    issueDraft.value.supportDeadlineDays = null;
  }
}

function makeDefault() {
  if (!defaultDraft.value || defaultDraft.value.isDefault) return;
  emit('makeDefault');
}
</script>
