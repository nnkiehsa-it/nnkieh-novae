<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class="text-current"
    :class="sizeClass"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.59 10.49l6.82-3.98" />
    <path d="M8.59 13.51l6.82 3.98" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  size?: number;
}>(), {
  size: 5,
});

const sizeClass = computed(() => `h-${props.size} w-${props.size}`);
</script>
