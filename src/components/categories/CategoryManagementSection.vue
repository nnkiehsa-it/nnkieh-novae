<template>
  <section class="space-y-3">
    <div class="flex items-end justify-between gap-3">
      <div>
        <h2 class="text-lg font-bold text-ink-950 dark:text-ink-50">{{ title }}</h2>
        <p class="mt-1 text-xs leading-5 text-ink-500">{{ description }}</p>
      </div>
      <AppButton variant="secondary" @click="emit('add')">{{ t('categoryAdmin.addCategory') }}</AppButton>
    </div>

    <div v-for="(category, index) in model" :key="category.id || `new-${index}`" class="space-y-2">
      <CategoryEditorCard
        v-model="model[index]"
        :field-id="`manage-${kind}-${index}`"
        :kind="kind"
        :id-locked="Boolean(category.id && originalIds.has(category.id))"
        :privacy-locked="kind === 'issue' && Boolean(category.id && originalIds.has(category.id))"
        :removable="false"
      />
      <SurfacePanel variant="control" padding="sm" class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap gap-2">
          <AppButton
            variant="toolbar"
            :class="category.isActive ? 'button-toolbar--active' : ''"
            @click="category.isActive = !category.isActive"
          >
            {{ t(category.isActive ? 'categoryAdmin.active' : 'categoryAdmin.archived') }}
          </AppButton>
          <AppButton
            variant="toolbar"
            :class="category.isDefault ? 'button-toolbar--active' : ''"
            @click="makeDefault(index)"
          >
            {{ t(category.isDefault ? 'categoryAdmin.defaultCategory' : 'categoryAdmin.makeDefault') }}
          </AppButton>
        </div>
        <AppButton variant="primary" :disabled="savingIndex === index" @click="save(index)">
          <BusyButtonContent :busy="savingIndex === index" :label="t('common.save')" :busy-label="t('common.saving')" />
        </AppButton>
      </SurfacePanel>
      <InlineMessage v-if="errors[index]">{{ errors[index] }}</InlineMessage>
    </div>
  </section>
</template>

<script setup lang="ts" generic="T extends IssueCategoryConfig | FacilityCategoryConfig">
import { ref } from 'vue';
import CategoryEditorCard from '@/components/categories/CategoryEditorCard.vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import BusyButtonContent from '@/components/ui/atoms/BusyButtonContent.vue';
import InlineMessage from '@/components/ui/atoms/InlineMessage.vue';
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';
import { useI18n } from '@/i18n';
import type { FacilityCategoryConfig, IssueCategoryConfig } from '@/types/categories';

const props = defineProps<{
  description: string;
  kind: 'facility' | 'issue';
  onSave: (index: number) => Promise<void>;
  title: string;
}>();
const model = defineModel<T[]>({ required: true });
const emit = defineEmits<{ add: [] }>();
const { t } = useI18n();
const originalIds = new Set(model.value.map((category) => category.id).filter(Boolean));
const savingIndex = ref<number | null>(null);
const errors = ref<Record<number, string>>({});

function makeDefault(index: number) {
  model.value.forEach((category, categoryIndex) => { category.isDefault = categoryIndex === index; });
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
