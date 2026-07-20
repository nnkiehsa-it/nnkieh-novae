<template>
  <section class="space-y-3">
    <SectionHeader :title="title" :description="description">
      <template #trailing>
        <AppButton variant="secondary" @click="addCategory">{{ t('categoryAdmin.addCategory') }}</AppButton>
      </template>
    </SectionHeader>

    <div class="grid items-start gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <SurfacePanel variant="list" padding="sm" class="space-y-1">
        <p class="px-2 pb-2 text-xs font-semibold text-ink-500">
          {{ t('adminCenter.categoryListCount', { count: model.length }) }}
        </p>
        <ListSurfaceRow
          v-for="(category, index) in model"
          :key="category.id || `new-${index}`"
          as="button"
          interactive
          class="w-full text-left"
          :class="selectedIndex === index ? 'button-toolbar--active' : ''"
          :aria-current="selectedIndex === index ? 'true' : undefined"
          @click="selectedIndex = index"
        >
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold text-ink-900 dark:text-ink-100">
              {{ category.label || t('categoryAdmin.untitledCategory') }}
            </span>
            <span class="mt-0.5 block truncate text-xs text-ink-500">
              {{ category.id || t('adminCenter.notSavedYet') }}
            </span>
          </span>
          <div class="shrink-0 flex flex-col items-end gap-1">
            <span class="text-[11px] font-semibold" :class="category.isActive ? 'text-success' : 'text-ink-400'">
              {{ t(category.isActive ? 'categoryAdmin.active' : 'categoryAdmin.archived') }}
            </span>
            <span v-if="category.isDefault" class="rounded bg-primary-50 px-1 py-0.5 text-[9px] font-bold text-primary-700 dark:bg-primary-950/30 dark:text-primary-400">
              {{ t('categoryAdmin.defaultCategory') }}
            </span>
          </div>
        </ListSurfaceRow>
      </SurfacePanel>

      <div v-if="selectedCategory" class="min-w-0 space-y-2">
        <CategoryEditorCard
          v-model="model[selectedIndex]"
          :field-id="`manage-${kind}-${selectedIndex}`"
          :kind="kind"
          :id-locked="Boolean(selectedCategory.id && originalIds.has(selectedCategory.id))"
          :privacy-locked="kind === 'issue' && Boolean(selectedCategory.id && originalIds.has(selectedCategory.id))"
          :removable="false"
        />

        <SurfacePanel variant="control" padding="sm" class="space-y-2">
          <ListSurfaceRow interactive @click="selectedCategory.isActive = !selectedCategory.isActive">
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-ink-900 dark:text-ink-100">{{ t('adminCenter.acceptNewRecords') }}</span>
              <span class="mt-0.5 block text-xs leading-5 text-ink-500">{{ t('adminCenter.acceptNewRecordsHelp') }}</span>
            </span>
            <SwitchIndicator :checked="selectedCategory.isActive" :label="t('adminCenter.acceptNewRecords')" />
          </ListSurfaceRow>
          <SelectionOptionButton
            label="categoryAdmin.defaultCategory"
            description="adminCenter.defaultCategoryHelp"
            :selected="selectedCategory.isDefault"
            @select="makeDefault(selectedIndex)"
          />
          <div class="flex flex-col gap-2 border-t border-ink-100 pt-3 dark:border-ink-800">
            <div class="flex items-center justify-between gap-3">
              <p class="text-xs leading-5 text-ink-500">
                <span v-if="selectedCategory.isDefault" class="text-error font-semibold">
                  {{ t('categoryAdmin.cannotDeleteDefaultCategoryHelp') }}
                </span>
                <span v-else>
                  {{ t('adminCenter.saveCategoryHelp') }}
                </span>
              </p>
              <div class="flex items-center gap-2 shrink-0">
                <AppButton
                  v-if="onDelete"
                  variant="danger"
                  :disabled="selectedCategory.isDefault || deletingIndex === selectedIndex"
                  @click="confirmDelete(selectedIndex)"
                >
                  <BusyButtonContent :busy="deletingIndex === selectedIndex" :label="t('categoryAdmin.deleteCategory')" :busy-label="t('common.deleting')" />
                </AppButton>
                <AppButton variant="primary" :disabled="savingIndex === selectedIndex" @click="save(selectedIndex)">
                  <BusyButtonContent :busy="savingIndex === selectedIndex" :label="t('common.save')" :busy-label="t('common.saving')" />
                </AppButton>
              </div>
            </div>
          </div>
        </SurfacePanel>
        <InlineMessage v-if="errors[selectedIndex]">{{ errors[selectedIndex] }}</InlineMessage>
      </div>
    </div>

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
      :message="t('categoryAdmin.deleteConfirmMessage')"
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
import CategoryWizardDialog from '@/components/admin/CategoryWizardDialog.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import BusyButtonContent from '@/components/ui/atoms/BusyButtonContent.vue';
import InlineMessage from '@/components/ui/atoms/InlineMessage.vue';
import SwitchIndicator from '@/components/ui/atoms/SwitchIndicator.vue';
import ListSurfaceRow from '@/components/ui/molecules/ListSurfaceRow.vue';
import SectionHeader from '@/components/ui/molecules/SectionHeader.vue';
import SelectionOptionButton from '@/components/ui/molecules/SelectionOptionButton.vue';
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';
import { useI18n } from '@/i18n';
import type { FacilityCategoryConfig, IssueCategoryConfig } from '@/types/categories';

const props = defineProps<{
  description: string;
  kind: 'facility' | 'issue';
  onSave: (index: number) => Promise<void>;
  onDelete?: (index: number) => Promise<void>;
  title: string;
}>();
const model = defineModel<T[]>({ required: true });
const emit = defineEmits<{ add: [] }>();
const { t } = useI18n();
const originalIds = new Set(model.value.map((category) => category.id).filter(Boolean));
const selectedIndex = ref(0);
const savingIndex = ref<number | null>(null);
const errors = ref<Record<number, string>>({});
const selectedCategory = computed(() => model.value[selectedIndex.value] ?? null);
const isWizardOpen = ref(false);

watch(() => model.value.length, (length) => {
  if (selectedIndex.value >= length) selectedIndex.value = Math.max(0, length - 1);
});

function addCategory() {
  isWizardOpen.value = true;
}

function handleCategoryCreated(newCategory: any) {
  model.value.push(newCategory as T);
  originalIds.add(newCategory.id);
  selectedIndex.value = model.value.length - 1;
}

const deletingIndex = ref<number | null>(null);
const isDeleteConfirmOpen = ref(false);

function makeDefault(index: number) {
  model.value.forEach((category, categoryIndex) => { category.isDefault = categoryIndex === index; });
}

async function confirmDelete(index: number) {
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

async function save(index: number) {
  savingIndex.value = index;
  errors.value[index] = '';
  try {
    await props.onSave(index);
    originalIds.add(model.value[index].id);
  } catch (caught) {
    errors.value[index] = t(caught instanceof Error ? caught.message : 'common.saveFailed');
  } finally {
    savingIndex.value = null;
  }
}
</script>
