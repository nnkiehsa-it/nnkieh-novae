<template>
  <section class="space-y-3">
    <SectionHeader :title="title" :description="description">
      <template #trailing>
        <div class="flex shrink-0 flex-wrap items-center justify-end gap-3">
          <slot name="header-actions" />
          <AppButton variant="secondary" :disabled="disabled" @click="addCategory">{{ t('categoryAdmin.addCategory') }}</AppButton>
        </div>
      </template>
    </SectionHeader>

    <InlineMessage v-if="disabled">{{ t('adminCenter.featureDisabledDraftHelp') }}</InlineMessage>

    <fieldset
      class="min-w-0 border-0 p-0 transition-opacity"
      :class="disabled ? 'opacity-45' : ''"
      :disabled="disabled"
      :aria-disabled="disabled || undefined"
    >
      <div class="grid items-start gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <CategorySelectorList
          v-model:selected-index="selectedIndex"
          :categories="model"
          show-default
        />

        <div v-if="selectedCategory" class="min-w-0 space-y-2">
          <CategoryEditorCard
            v-model="model[selectedIndex]"
            :field-id="`manage-${kind}-${selectedIndex}`"
            :kind="kind"
            :id-locked="Boolean(selectedCategory.id && persistedIds.has(selectedCategory.id))"
            :privacy-locked="kind === 'issue' && Boolean(selectedCategory.id && persistedIds.has(selectedCategory.id))"
            :removable="false"
            default-control
            :deletable="Boolean(onDelete)"
            :deleting="deletingIndex === selectedIndex"
            @delete="confirmDelete(selectedIndex)"
            @make-default="makeDefault(selectedIndex)"
          />
          <InlineMessage v-if="errors[selectedIndex]">{{ errors[selectedIndex] }}</InlineMessage>
        </div>
      </div>
    </fieldset>

    <!-- Step-by-step creation wizard -->
    <CategoryWizardDialog
      :open="isWizardOpen"
      :kind="kind"
      :sort-order="model.length"
      @close="isWizardOpen = false"
      @created="handleCategoryCreated"
    />

    <!-- Category deletion confirmation dialog -->
    <ConfirmDialog
      v-if="onDelete"
      :open="isDeleteConfirmOpen"
      :title="t('categoryAdmin.deleteConfirmTitle', { name: selectedCategory?.label })"
      :message="t('categoryAdmin.deleteDraftConfirmMessage')"
      confirm-label="common.delete"
      :busy="deletingIndex === selectedIndex"
      @confirm="handleDelete(selectedIndex)"
      @cancel="isDeleteConfirmOpen = false"
    />
  </section>
</template>

<script setup lang="ts" generic="T extends IssueCategoryConfig | FacilityCategoryConfig">
import { computed, ref, watch } from 'vue';
import CategoryEditorCard from '@/components/categories/CategoryEditorCard.vue';
import CategorySelectorList from '@/components/categories/CategorySelectorList.vue';
import CategoryWizardDialog from '@/components/admin/CategoryWizardDialog.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import InlineMessage from '@/components/ui/atoms/InlineMessage.vue';
import SectionHeader from '@/components/ui/molecules/SectionHeader.vue';
import { useI18n } from '@/i18n';
import type {
  CategoryConfig,
  FacilityCategoryConfig,
  IssueCategoryConfig,
} from '@/types/categories';

const props = defineProps<{
  description: string;
  disabled?: boolean;
  kind: 'facility' | 'issue';
  onDelete?: (index: number) => Promise<void>;
  persistedIds: ReadonlySet<string>;
  title: string;
}>();
const model = defineModel<T[]>({ required: true });
const { t } = useI18n();
const selectedIndex = ref(0);
const errors = ref<Record<number, string>>({});
const selectedCategory = computed(() => model.value[selectedIndex.value] ?? null);
const isWizardOpen = ref(false);

watch(() => model.value.length, (length) => {
  if (selectedIndex.value >= length) selectedIndex.value = Math.max(0, length - 1);
});

function addCategory() {
  isWizardOpen.value = true;
}

function handleCategoryCreated(newCategory: CategoryConfig) {
  model.value.push(newCategory as T);
  selectedIndex.value = model.value.length - 1;
}

const deletingIndex = ref<number | null>(null);
const isDeleteConfirmOpen = ref(false);

function makeDefault(index: number) {
  model.value.forEach((category, categoryIndex) => { category.isDefault = categoryIndex === index; });
}

function confirmDelete(index: number) {
  isDeleteConfirmOpen.value = true;
}

async function handleDelete(index: number) {
  isDeleteConfirmOpen.value = false;
  deletingIndex.value = index;
  errors.value[index] = '';
  try {
    if (props.onDelete) {
      await props.onDelete(index);
    }
  } catch (caught) {
    errors.value[index] = t(caught instanceof Error ? caught.message : 'common.saveFailed');
  } finally {
    deletingIndex.value = null;
  }
}

</script>
