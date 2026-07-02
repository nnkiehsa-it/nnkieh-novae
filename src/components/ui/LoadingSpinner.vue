<template>
  <svg
    class="text-current"
    :class="[sizeClass, $attrs.class]"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle class="opacity-15" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" />
    <path
      class="opacity-80"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  size?: number;
}>(), {
  size: 4,
});

const sizeMap: Record<number, string> = { 4: 'h-4 w-4', 6: 'h-6 w-6', 8: 'h-8 w-8' };
const sizeClass = computed(() => `${sizeMap[props.size] ?? 'h-4 w-4'} animate-spinner`);
</script>
