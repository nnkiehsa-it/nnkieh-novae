<template>
  <span class="inline-flex items-center justify-center gap-2">
    <LoadingSpinner v-if="busy" :size="spinnerSize" class="shrink-0" />
    <template v-if="busy">
      {{ busyLabel || label || '處理中...' }}
    </template>
    <template v-else>
      <slot>{{ label }}</slot>
    </template>
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
