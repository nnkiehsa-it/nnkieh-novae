<template>
  <div
    class="h-full min-h-0 pb-0 md:pb-5"
    :aria-label="label || t('common.loading')"
    aria-busy="true"
  >
    <!-- Desktop Viewport Skeleton -->
    <article
      v-if="isDesktopViewport"
      class="flex h-full min-h-0 flex-col overflow-visible"
    >
      <header class="flex shrink-0 items-center gap-3 px-1 py-2">
        <!-- Back Button -->
        <SkeletonBlock as="div" class="h-8 w-8 shrink-0 rounded-full" />
        <!-- Tags -->
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2 pt-1.5">
          <SkeletonBlock as="div" class="h-6 w-16 rounded-full" />
          <SkeletonBlock as="div" class="h-6 w-20 rounded-full" />
        </div>
      </header>

      <div
        class="grid min-h-0 min-w-0 flex-1 border-t border-ink-100/70 dark:border-ink-800/70"
        :class="{
          'md:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]': showComments,
        }"
      >
        <!-- Details Column -->
        <div class="flex min-h-0 min-w-0 flex-col py-3 pr-5 space-y-6">
          <!-- Title -->
          <div class="pb-1">
            <SkeletonBlock as="div" class="h-7 w-3/4 rounded" />
          </div>
          <!-- Author -->
          <div
            class="flex items-center gap-3 border-b border-ink-100 pb-3 dark:border-ink-800/60"
          >
            <SkeletonBlock as="div" class="h-10 w-10 shrink-0 rounded-full" />
            <div class="min-w-0 flex-1 space-y-2">
              <SkeletonBlock as="div" class="h-3.5 w-24 rounded" />
              <SkeletonBlock as="div" class="h-3 w-32 rounded" />
            </div>
          </div>
          <!-- Body content -->
          <div class="space-y-4 pt-2">
            <SkeletonBlock as="div" class="h-4 w-full rounded" />
            <SkeletonBlock as="div" class="h-4 w-full rounded" />
            <SkeletonBlock as="div" class="h-4 w-5/6 rounded" />
            <SkeletonBlock as="div" class="h-4 w-11/12 rounded" />
            <SkeletonBlock as="div" class="h-4 w-3/4 rounded" />
          </div>
        </div>

        <!-- Comments Column -->
        <aside
          v-if="showComments"
          class="flex min-h-0 min-w-0 flex-col border-l border-ink-100/70 py-3 pl-5 dark:border-ink-800/70 space-y-4"
        >
          <div
            class="flex items-center gap-2 border-b border-ink-100 pb-2 dark:border-ink-800/60"
          >
            <SkeletonBlock as="div" class="h-5 w-5 rounded" />
            <SkeletonBlock as="div" class="h-4 w-16 rounded" />
          </div>
          <div class="space-y-1 pt-1">
            <div
              v-for="index in 2"
              :key="index"
              class="flex items-start gap-2.5 py-2.5"
            >
              <SkeletonBlock as="div" class="h-8 w-8 shrink-0 rounded-full" />
              <div class="min-w-0 flex-1 space-y-2">
                <div class="flex items-center gap-2">
                  <SkeletonBlock as="div" class="h-3.5 w-24 rounded" />
                  <SkeletonBlock as="div" class="h-3 w-14 rounded" />
                </div>
                <SkeletonBlock as="div" class="h-3.5 w-full rounded" />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </article>

    <!-- Mobile Viewport Skeleton -->
    <article
      v-else
      class="flex h-full min-h-0 flex-col overflow-visible"
    >
      <header class="flex shrink-0 items-start gap-3 px-0 py-3">
        <!-- Tags -->
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2 pt-1.5">
          <SkeletonBlock as="div" class="h-6 w-16 rounded-full" />
          <SkeletonBlock as="div" class="h-6 w-20 rounded-full" />
        </div>
      </header>

      <div
        class="flex min-h-0 flex-1 flex-col border-t border-ink-100/70 dark:border-ink-800/70"
      >
        <div
          class="comment-feed-scroll scroll-shadow-space--compact min-h-0 flex-1 overflow-auto py-3 space-y-5"
        >
          <!-- Title -->
          <div class="pb-1">
            <SkeletonBlock as="div" class="h-6 w-3/4 rounded" />
          </div>
          <!-- Author -->
          <div
            class="flex items-center gap-3 border-b border-ink-100 pb-3 dark:border-ink-800/60"
          >
            <SkeletonBlock as="div" class="h-8 w-8 shrink-0 rounded-full" />
            <div class="min-w-0 flex-1 space-y-2">
              <SkeletonBlock as="div" class="h-3.5 w-24 rounded" />
              <SkeletonBlock as="div" class="h-3 w-32 rounded" />
            </div>
          </div>
          <!-- Body content -->
          <div class="space-y-4 pt-1">
            <SkeletonBlock as="div" class="h-4 w-full rounded" />
            <SkeletonBlock as="div" class="h-4 w-full rounded" />
            <SkeletonBlock as="div" class="h-4 w-5/6 rounded" />
            <SkeletonBlock as="div" class="h-4 w-11/12 rounded" />
            <SkeletonBlock as="div" class="h-4 w-3/4 rounded" />
          </div>
          <div class="mt-4 space-y-3">
            <SkeletonBlock as="div" class="h-2 w-3/4 rounded" />
            <SkeletonBlock as="div" class="h-10 w-40 rounded-full" />
          </div>
          <div class="mt-8 space-y-3">
            <div class="flex items-center justify-between">
              <SkeletonBlock as="div" class="h-5 w-24 rounded" />
              <SkeletonBlock as="div" class="h-5 w-10 rounded-full" />
            </div>
            <SkeletonBlock as="div" class="h-16 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "@/i18n";
import SkeletonBlock from "@/components/ui/atoms/SkeletonBlock.vue";

const { t } = useI18n();

withDefaults(
  defineProps<{
    label?: string;
    showComments?: boolean;
  }>(),
  {
    label: "",
    showComments: true,
  },
);

const isDesktopViewport = ref(
  typeof window === "undefined"
    ? false
    : window.matchMedia("(min-width: 768px)").matches,
);
let desktopMediaQuery: MediaQueryList | null = null;

function syncDesktopViewport(event?: MediaQueryListEvent) {
  isDesktopViewport.value =
    event?.matches ?? desktopMediaQuery?.matches ?? window.innerWidth >= 768;
}

onMounted(() => {
  desktopMediaQuery = window.matchMedia("(min-width: 768px)");
  syncDesktopViewport();
  desktopMediaQuery.addEventListener("change", syncDesktopViewport);
});

onBeforeUnmount(() => {
  desktopMediaQuery?.removeEventListener("change", syncDesktopViewport);
});
</script>
