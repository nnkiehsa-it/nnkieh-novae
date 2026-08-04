<template>
  <header class="app-header fixed inset-x-0 top-0 z-40 w-full transition-colors duration-300 md:hidden">
    <ViewportFrame class="app-header__inner flex items-center justify-between">
      <div class="app-header__leading flex min-w-0 items-center">
        <div
          class="app-header__back-slot shrink-0"
          :class="{ 'app-header__back-slot--visible': showBackButton }"
          :aria-hidden="!showBackButton || undefined"
        >
          <AppButton
            variant="icon"
            class="app-header__back md:hidden"
            :disabled="!showBackButton"
            :tabindex="showBackButton ? undefined : -1"
            :aria-label="backLabel"
            :title="showBackButton ? backLabel : undefined"
            @click="$emit('back')"
          >
            <AppIcon name="chevron-left" :size="6" />
          </AppButton>
        </div>
        <h1 class="app-header__title flex min-w-0 items-center text-ink-950 dark:text-ink-50" :aria-label="title">
          <BoardCategorySelector
            v-if="categoryFilter && categoryLabel"
            :model-value="categoryFilter"
            :label="categoryLabel"
            :options="categoryOptions"
            :selector-label="categorySelectorLabel"
            variant="mobile-header"
            @update:model-value="filter => $emit('select-category', filter)"
          />
          <span v-else class="truncate text-2xl font-semibold leading-tight tracking-[0.015em]">{{ title }}</span>
        </h1>
      </div>
    </ViewportFrame>
  </header>
</template>

<script setup lang="ts">
import BoardCategorySelector from '@/components/BoardCategorySelector.vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import ViewportFrame from '@/components/ui/organisms/ViewportFrame.vue';

defineProps<{
  backLabel: string;
  categoryFilter?: string;
  categoryLabel?: string;
  categoryOptions: ReadonlyArray<{ label: string; value: string }>;
  categorySelectorLabel: string;
  showBackButton: boolean;
  title: string;
}>();

defineEmits<{
  back: [];
  'select-category': [filter: string];
}>();
</script>
