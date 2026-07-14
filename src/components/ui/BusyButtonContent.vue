<template>
  <span class="busy-button-content relative inline-grid min-w-0 place-items-center" :class="{ 'is-busy': busy }">
    <span class="col-start-1 row-start-1 inline-flex items-center justify-center gap-2 transition-opacity" :class="busy ? 'opacity-0' : 'opacity-100'">
      <slot>{{ label }}</slot>
    </span>
    <span v-if="busy" class="col-start-1 row-start-1 inline-flex items-center justify-center gap-2" role="status">
      <span class="busy-button-spinner grid place-items-center rounded-full" aria-hidden="true">
        <LoadingSpinner :size="spinnerSize" class="shrink-0" />
      </span>
      {{ busyLabel || label || '處理中' }}
    </span>
  </span>
</template>

<script setup lang="ts">
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';

withDefaults(defineProps<{
  busy?: boolean;
  label?: string;
  busyLabel?: string;
  spinnerSize?: number;
}>(), {
  busy: false,
  label: '',
  busyLabel: '',
  spinnerSize: 4,
});
</script>

<style scoped>
.busy-button-spinner {
  box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 24%, transparent);
  animation: busy-spinner-ring 1.2s ease-out infinite;
}

@keyframes busy-spinner-ring {
  60%, 100% { box-shadow: 0 0 0 0.3rem transparent; }
}

@media (prefers-reduced-motion: reduce) {
  .busy-button-spinner { animation: none; }
}
</style>
