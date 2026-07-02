<template>
  <img
    v-if="photoUrl"
    :src="photoUrl"
    :alt="altText"
    class="rounded-full border border-ink-300 object-cover dark:border-ink-700"
    :class="imageSizeClass"
  />
  <div
    v-else
    class="flex items-center justify-center rounded-full border border-ink-300 bg-ink-100 font-semibold dark:border-ink-700 dark:bg-ink-950"
    :class="[fallbackSizeClass, textSizeClass]"
  >
    {{ fallbackText }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  photoUrl: string | null | undefined;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  altText?: string;
}>(), {
  size: 'md',
  altText: '使用者頭像',
});

const imageSizeClass = computed(() => {
  if (props.size === 'sm') return 'h-7 w-7';
  if (props.size === 'lg') return 'h-10 w-10';
  return 'h-8 w-8';
});

const fallbackSizeClass = computed(() => {
  if (props.size === 'sm') return 'h-7 w-7';
  if (props.size === 'lg') return 'h-10 w-10';
  return 'h-8 w-8';
});

const textSizeClass = computed(() => {
  if (props.size === 'sm') return 'text-xs';
  if (props.size === 'lg') return 'text-sm';
  return 'text-xs';
});

const fallbackText = computed(() => {
  return props.name ? props.name.slice(0, 1) : '匿';
});
</script>
