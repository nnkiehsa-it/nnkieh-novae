<template>
  <div class="space-y-4">
    <div v-if="images.length" class="flex snap-x gap-3 overflow-x-auto pb-2">
      <button
        v-for="image in images"
        :key="image.uploadId || image.src"
        type="button"
        class="content-trigger w-32 shrink-0 snap-start overflow-hidden rounded-lg border border-ink-200 bg-ink-50 dark:border-ink-800 dark:bg-ink-950 sm:w-40"
        :disabled="Boolean(image.uploadId && !image.isUploadResolved)"
        :aria-label="`放大圖片：${image.alt || fallbackAlt}`"
        @click="selectedImage = image"
      >
        <div
          v-if="image.uploadId && image.resolveError"
          class="flex aspect-[4/3] w-full flex-col items-center justify-center bg-error-container/40 p-2 text-center text-error"
        >
          <span class="material-symbols-outlined text-[20px]">warning</span>
          <span class="mt-1 text-[10px] font-medium">載入失敗</span>
        </div>
        <div
          v-else-if="image.uploadId && !image.isUploadResolved"
          class="flex aspect-[4/3] w-full animate-pulse items-center justify-center bg-ink-200/60 text-ink-400 dark:bg-ink-700/50 dark:text-ink-500"
        >
          <LoadingSpinner :size="5" />
        </div>
        <img
          v-else
          :src="image.src"
          :alt="image.alt || fallbackAlt"
          class="aspect-[4/3] w-full object-cover"
          loading="lazy"
        >
      </button>
    </div>

    <div v-if="textContent" class="font-sans text-sm font-normal leading-relaxed text-ink-700 dark:text-ink-200 sm:text-base">
      <MarkdownRenderer :content="textContent" />
    </div>

    <Teleport to="body">
      <Transition name="dialog" appear>
        <div
          v-if="selectedImage"
          class="fixed inset-0 z-[70] flex h-dvh items-center justify-center bg-ink-950/90 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm"
          @click.self="selectedImage = null"
        >
          <button
            type="button"
            class="button-icon-filled absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] border-white/20 bg-white text-ink-950 hover:bg-white/90"
            aria-label="關閉圖片"
            @click="selectedImage = null"
          >
            ×
          </button>
          <img
            :src="selectedImage.fullSrc || selectedImage.src"
            :alt="selectedImage.alt || fallbackAlt"
            class="max-h-full max-w-full object-contain"
          >
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import MarkdownRenderer from '@/components/MarkdownRenderer.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import { stripMarkdownImages } from '@/lib/markdown-images';
import { useResolvedMarkdown } from '@/composables/useResolvedMarkdown';
import type { MarkdownImageRecord } from '@/types';

const props = defineProps<{
  content: string;
  fallbackAlt: string;
}>();

const selectedImage = ref<MarkdownImageRecord | null>(null);
const { images, resolvedContent } = useResolvedMarkdown(() => props.content);
const textContent = computed(() => stripMarkdownImages(resolvedContent.value));
</script>
