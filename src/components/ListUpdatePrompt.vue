<template>
  <Transition name="board-content" appear>
    <div
      v-if="show"
      class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary-container px-4 py-3 text-sm text-on-primary-container"
      role="status"
      aria-live="polite"
    >
      <span class="font-semibold">{{ message }}</span>
      <button
        type="button"
        class="button-secondary !min-h-0 !px-3 !py-1.5"
        :disabled="loading"
        @click="emit('action')"
      >
        <AppIcon name="refresh" class="h-3.5 w-3.5" :class="{ 'animate-spinner': loading }" />
        <span>{{ loading ? loadingLabel : actionLabel }}</span>
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue';

withDefaults(defineProps<{
  actionLabel: string;
  loading?: boolean;
  loadingLabel?: string;
  message: string;
  show: boolean;
}>(), {
  loading: false,
  loadingLabel: '更新中...',
});

const emit = defineEmits<{
  action: [];
}>();
</script>
