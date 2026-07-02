<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class="text-current transition-colors"
    :class="sizeClass"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <g>
      <path d="M4 7l16 0" />
      <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
    </g>
    <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
    <path d="M10 11l0 6" />
    <path d="M14 11l0 6" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  size?: number;
}>(), {
  size: 4,
});

const sizeClass = computed(() => `h-${props.size} w-${props.size}`);
</script>
