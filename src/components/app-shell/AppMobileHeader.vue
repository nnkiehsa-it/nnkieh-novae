<template>
  <header class="app-header fixed inset-x-0 top-0 z-40 w-full backdrop-blur-md transition-colors duration-300 md:hidden">
    <div class="app-header__inner mx-auto flex max-w-7xl items-center px-4 sm:px-6">
      <div class="flex min-w-0 items-center gap-3">
        <button
          v-if="showBackButton"
          type="button"
          class="button-icon shrink-0 md:hidden"
          :aria-label="backLabel"
          :title="backLabel"
          @click="$emit('back')"
        >
          <AppIcon name="chevron-left" :size="5" />
        </button>
        <h1 class="app-header__title flex h-10 min-w-0 shrink-0 items-center text-ink-950 dark:text-ink-50" :aria-label="title">
          <span class="truncate text-2xl font-semibold leading-tight tracking-[0.015em]">{{ title }}</span>
        </h1>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue';

defineProps<{
  backLabel: string;
  showBackButton: boolean;
  title: string;
}>();

defineEmits<{
  back: [];
}>();
</script>
