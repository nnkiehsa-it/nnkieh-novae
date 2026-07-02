<template>
  <div
    v-if="images.length"
    class="flex flex-wrap gap-3 border-b border-ink-100 dark:border-ink-800 shrink-0"
    :class="size === 'lg' ? 'p-4' : 'p-3'"
  >
    <div
      v-for="image in images"
      :key="image.key"
      class="relative overflow-hidden rounded-xl border border-ink-200 bg-ink-50 dark:border-ink-800 dark:bg-ink-900"
      :class="size === 'lg' ? 'h-24 w-24' : 'h-16 w-16'"
    >
      <img :src="image.src" :alt="image.alt" class="h-full w-full object-cover">
      <button
        type="button"
        class="button-remove-image cursor-pointer"
        aria-label="移除圖片"
        @click="emit('remove-image', image.key)"
      >
        <AppIcon name="close" :size="3" :stroke-width="2.5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue';

export interface MarkdownEditorImage {
  alt: string;
  key: string;
  src: string;
}

withDefaults(defineProps<{
  images: MarkdownEditorImage[];
  size?: 'sm' | 'lg';
}>(), {
  size: 'sm',
});

const emit = defineEmits<{
  'remove-image': [key: string];
}>();
</script>
