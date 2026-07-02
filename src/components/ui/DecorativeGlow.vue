<template>
  <div
    class="pointer-events-none absolute -left-16 -top-16 z-0 rounded-full bg-[radial-gradient(circle,rgb(var(--color-primary)/0.12)_0%,rgb(var(--color-primary)/0.06)_42%,transparent_72%)] dark:hidden"
    :class="leftSize"
    aria-hidden="true"
  ></div>
  <div
    class="pointer-events-none absolute -right-16 -bottom-16 z-0 rounded-full bg-[radial-gradient(circle,rgb(var(--color-secondary)/0.12)_0%,rgb(var(--color-secondary)/0.06)_42%,transparent_72%)] dark:hidden"
    :class="rightSize"
    aria-hidden="true"
  ></div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  size?: 'sm' | 'md';
}>(), {
  size: 'md',
});

const leftSize = computed(() => props.size === 'sm' ? 'h-48 w-48' : 'h-64 w-64');
const rightSize = computed(() => props.size === 'sm' ? 'h-48 w-48' : 'h-64 w-64');
</script>
