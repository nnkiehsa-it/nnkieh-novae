<template>
  <div class="route-page pb-3 sm:pb-5" :aria-label="label || t('common.loading')" aria-busy="true">
    <!-- Desktop Viewport Skeleton -->
    <article
      v-if="isDesktopViewport"
      class="panel flex min-h-[calc(100dvh-2.5rem)] flex-col overflow-visible"
    >
      <header class="flex shrink-0 items-center gap-3 px-5 py-4">
        <!-- Back Button -->
        <div class="h-8 w-8 shrink-0 rounded-full bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
        <!-- Tags -->
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2 pt-1.5">
          <div class="h-6 w-16 rounded-full bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
          <div class="h-6 w-20 rounded-full bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
        </div>
      </header>

      <div
        class="grid min-w-0 flex-1 border-t border-ink-100/70 dark:border-ink-800/70"
        :class="{ 'md:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]': showComments }"
      >
        <!-- Details Column -->
        <div class="flex min-h-0 min-w-0 flex-col px-5 py-5 pr-6 space-y-6">
          <!-- Title -->
          <div class="space-y-3 pb-1">
            <div class="h-7 w-3/4 rounded bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
            <div class="h-7 w-1/2 rounded bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
          </div>
          <!-- Author -->
          <div class="flex items-center gap-3 border-b border-ink-100 pb-3 dark:border-ink-800/60">
            <div class="h-10 w-10 shrink-0 rounded-full bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
            <div class="min-w-0 flex-1 space-y-2">
              <div class="h-3.5 w-24 rounded bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
              <div class="h-3 w-32 rounded bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
            </div>
          </div>
          <!-- Body content -->
          <div class="space-y-4 pt-2">
            <div class="h-4 w-full rounded bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
            <div class="h-4 w-full rounded bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
            <div class="h-4 w-5/6 rounded bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
            <div class="h-4 w-11/12 rounded bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
            <div class="h-4 w-3/4 rounded bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
          </div>
        </div>

        <!-- Comments Column -->
        <aside
          v-if="showComments"
          class="flex min-h-0 min-w-0 flex-col border-l border-ink-100/70 px-5 py-5 dark:border-ink-800/70 space-y-4"
        >
          <div class="flex items-center gap-2 border-b border-ink-100 pb-2 dark:border-ink-800/60">
            <div class="h-5 w-5 rounded bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
            <div class="h-4 w-16 rounded bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
          </div>
          <div class="space-y-1 pt-1">
            <div v-for="index in 2" :key="index" class="flex items-start gap-2.5 py-2.5">
              <div class="h-8 w-8 shrink-0 rounded-full bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
              <div class="min-w-0 flex-1 space-y-2">
                <div class="flex items-center gap-2">
                  <div class="h-3.5 w-24 rounded bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
                  <div class="h-3 w-14 rounded bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
                </div>
                <div class="h-3.5 w-full rounded bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </article>

    <!-- Mobile Viewport Skeleton -->
    <article
      v-else
      class="panel flex h-[calc(100dvh-var(--app-header-height)-var(--app-bottom-nav-height)-env(safe-area-inset-top)-1rem)] min-h-0 flex-col overflow-hidden"
    >
      <header class="flex shrink-0 items-start gap-3 px-4 py-3.5">
        <!-- Back Button -->
        <div class="h-8 w-8 shrink-0 rounded-full bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
        <!-- Tags -->
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2 pt-1.5">
          <div class="h-6 w-16 rounded-full bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
          <div class="h-6 w-20 rounded-full bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
        </div>
      </header>

      <div class="flex min-h-0 flex-1 flex-col border-t border-ink-100/70 dark:border-ink-800/70">
        <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-5">
          <!-- Title -->
          <div class="space-y-3 pb-1">
            <div class="h-6 w-3/4 rounded bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
            <div class="h-6 w-1/2 rounded bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
          </div>
          <!-- Author -->
          <div class="flex items-center gap-3 border-b border-ink-100 pb-3 dark:border-ink-800/60">
            <div class="h-8 w-8 shrink-0 rounded-full bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
            <div class="min-w-0 flex-1 space-y-2">
              <div class="h-3.5 w-24 rounded bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
              <div class="h-3 w-32 rounded bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
            </div>
          </div>
          <!-- Body content -->
          <div class="space-y-4 pt-1">
            <div class="h-4 w-full rounded bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
            <div class="h-4 w-full rounded bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
            <div class="h-4 w-5/6 rounded bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
            <div class="h-4 w-11/12 rounded bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
            <div class="h-4 w-3/4 rounded bg-ink-200/60 animate-skeleton dark:bg-ink-700/50"></div>
          </div>
        </div>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from '@/i18n';

const { t } = useI18n();

withDefaults(defineProps<{
  label?: string;
  showComments?: boolean;
}>(), {
  showComments: true,
});

const isDesktopViewport = ref(
  typeof window === 'undefined' ? false : window.matchMedia('(min-width: 768px)').matches,
);
let desktopMediaQuery: MediaQueryList | null = null;

function syncDesktopViewport(event?: MediaQueryListEvent) {
  isDesktopViewport.value = event?.matches ?? desktopMediaQuery?.matches ?? window.innerWidth >= 768;
}

onMounted(() => {
  desktopMediaQuery = window.matchMedia('(min-width: 768px)');
  syncDesktopViewport();
  desktopMediaQuery.addEventListener('change', syncDesktopViewport);
});

onBeforeUnmount(() => {
  desktopMediaQuery?.removeEventListener('change', syncDesktopViewport);
});
</script>
