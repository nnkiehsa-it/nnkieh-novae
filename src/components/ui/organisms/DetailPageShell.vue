<template>
  <section class="h-full min-h-0 pb-0 md:pb-5">
    <article
      v-if="isDesktopViewport"
      class="hidden h-full min-h-0 flex-col overflow-visible md:flex"
      :aria-label="t(detailsLabel)"
    >
      <header class="flex items-start gap-3 px-1 py-2">
        <AppButton
          variant="icon"
          class="shrink-0"
          :aria-label="t(backLabel)"
          :title="t(backLabel)"
          @click="emit('back')"
        >
          <AppIcon name="chevron-left" :size="5" />
        </AppButton>
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2 pt-1.5">
          <slot name="header" />
        </div>
      </header>

      <div
        class="grid min-h-0 min-w-0 flex-1"
        :class="{ 'md:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]': showComments }"
      >
        <div class="flex min-h-0 min-w-0 flex-col py-3 pr-5">
          <div class="scroll-shadow-space--compact min-h-0 flex-1 overflow-auto overscroll-contain">
            <slot name="details" :compact="false" :scroll-content="false" />
          </div>
          <div class="shrink-0">
            <slot name="actions" :compact="false" />
          </div>
        </div>

        <aside
          v-if="showComments"
          class="flex min-h-0 min-w-0 flex-col border-l border-ink-200/70 py-3 pl-5 dark:border-ink-800/70"
          :aria-label="t(commentsLabel)"
        >
          <slot name="comments" :embedded="false" />
        </aside>
      </div>
    </article>

    <article
      v-else
      class="flex h-full min-h-0 flex-col overflow-visible md:hidden"
      :aria-label="t(detailsLabel)"
    >
      <header class="flex shrink-0 items-center gap-3 px-0 py-2.5">
        <AppButton
          v-if="showMobileBackButton"
          variant="icon"
          class="shrink-0"
          :aria-label="t(backLabel)"
          :title="t(backLabel)"
          @click="emit('back')"
        >
          <AppIcon name="chevron-left" :size="5" />
        </AppButton>
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <slot name="header" />
        </div>
      </header>

      <div class="comment-feed-scroll min-h-0 flex-1 overflow-auto py-3 overscroll-contain">
        <slot name="details" :compact="true" :scroll-content="false" />
        <div class="mt-4 px-0">
          <slot name="actions" :compact="true" />
        </div>
        <section
          v-if="mobileCommentsVisible"
          ref="mobileCommentsRef"
          class="mt-6 border-t border-ink-200/70 pt-5 dark:border-ink-800/70"
          :aria-labelledby="mobileCommentsHeadingId"
        >
          <h3 :id="mobileCommentsHeadingId" class="sr-only">{{ t(commentsLabel) }}</h3>
          <slot name="comments" :embedded="true" />
        </section>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import { useI18n } from '@/i18n';

type DetailPageTab = 'details' | 'comments';

const props = withDefaults(defineProps<{
  backLabel?: string;
  commentsLabel?: string;
  detailsLabel: string;
  initialTab?: DetailPageTab;
  showMobileBackButton?: boolean;
  showComments?: boolean;
  showMobileComments?: boolean;
}>(), {
  backLabel: 'issue.return',
  commentsLabel: 'comments.title',
  initialTab: 'details',
  showMobileBackButton: true,
  showComments: true,
  showMobileComments: true,
});

const emit = defineEmits<{
  back: [];
}>();
const { t } = useI18n();

defineSlots<{
  actions(props: { compact: boolean }): unknown;
  comments(props: { embedded: boolean }): unknown;
  details(props: { compact: boolean; scrollContent: boolean }): unknown;
  header(): unknown;
}>();

const mobileCommentsRef = ref<HTMLElement | null>(null);
const mobileCommentsHeadingId = `detail-comments-${useId()}`;
const mobileCommentsVisible = computed(() => props.showMobileComments);
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
