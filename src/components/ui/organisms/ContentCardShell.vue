<template>
  <div class="relative" role="listitem">
    <article
      class="issue-card surface-card surface-card--interactive list-row-trigger relative overflow-hidden"
      data-list-row-trigger
      @click="handleCardClick"
      @focusin="emit('intent')"
      @pointerenter="schedulePointerIntent"
      @pointerleave="cancelPointerIntent"
    >
      <button
        type="button"
        class="pointer-events-none absolute inset-0 z-0 rounded-[var(--radius-outer)] border-0 bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-outline/70"
        :aria-label="title"
        @click.stop="emit('open')"
      ></button>

      <div class="relative z-10 flex items-start gap-3">
        <AuthorAvatar
          v-if="showAuthor && authorUid"
          :author-uid="authorUid"
          size="md"
          :alt-text="t('notification.nameAvatar', { name: authorName })"
          class="shrink-0 rounded-full"
        />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <SkeletonBlock v-if="showAuthor && authorUid && authorProfile.loading" class="block h-3.5 w-20 rounded" />
            <span v-else-if="showAuthor && authorUid" class="truncate text-xs font-normal text-ink-600 dark:text-ink-300 sm:text-sm">
              {{ authorName }}
            </span>
            <span v-if="timeLabel" class="shrink-0 text-xs font-normal text-ink-400 dark:text-ink-500">
              {{ timeLabel }}
            </span>
            <TagBadge size="sm" class="ml-auto shrink-0 font-semibold" :class="statusClass">
              {{ t(statusLabel) }}
            </TagBadge>
          </div>

          <h3 class="mt-1 line-clamp-2 text-base font-bold leading-snug tracking-tight text-ink-950 dark:text-ink-50 sm:font-semibold">
            <SearchHighlight :text="title" :query="highlightQuery" />
          </h3>
        </div>
      </div>

      <div class="relative z-10">
        <slot name="supplement" />
      </div>

      <footer v-if="$slots.actions" class="relative z-10 mt-3 flex items-center justify-end gap-1.5" @click.stop>
        <slot name="actions" />
      </footer>
    </article>
  </div>
</template>

<script setup lang="ts">
import AuthorAvatar from '@/components/AuthorAvatar.vue';
import TagBadge from '@/components/ui/atoms/TagBadge.vue';
import SearchHighlight from '@/components/ui/molecules/SearchHighlight.vue';
import SkeletonBlock from '@/components/ui/atoms/SkeletonBlock.vue';
import { useI18n } from '@/i18n';
import { computed, onBeforeUnmount } from 'vue';
import { useAuthorProfile } from '@/composables/useAuthorProfile';

const { t } = useI18n();

const props = withDefaults(defineProps<{
  authorUid?: string | null;
  highlightQuery?: string;
  showAuthor?: boolean;
  statusClass?: string;
  statusLabel: string;
  timeLabel: string;
  title: string;
}>(), {
  authorUid: null,
  highlightQuery: '',
  showAuthor: true,
  statusClass: '',
});

const authorProfile = useAuthorProfile(() => props.authorUid);
const authorName = computed(() => (
  authorProfile.value.loading
    ? ''
    : authorProfile.value.profile?.displayName || t('navigation.user')
));

const emit = defineEmits<{
  intent: [];
  open: [];
}>();
const POINTER_INTENT_DELAY_MS = 180;
let pointerIntentTimer = 0;

function canPrefetchForPointer(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || document.visibilityState !== 'visible') return false;
  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean };
  }).connection;
  return !connection?.saveData && connection?.effectiveType !== 'slow-2g' && connection?.effectiveType !== '2g';
}

function cancelPointerIntent() {
  window.clearTimeout(pointerIntentTimer);
  pointerIntentTimer = 0;
}

function schedulePointerIntent(event: PointerEvent) {
  cancelPointerIntent();
  if (!canPrefetchForPointer(event)) return;
  pointerIntentTimer = window.setTimeout(() => {
    pointerIntentTimer = 0;
    emit('intent');
  }, POINTER_INTENT_DELAY_MS);
}

onBeforeUnmount(cancelPointerIntent);
const NESTED_INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="link"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function handleCardClick(event: MouseEvent) {
  if (!(event.target instanceof Element) || !(event.currentTarget instanceof HTMLElement)) return;
  const nestedControl = event.target.closest(NESTED_INTERACTIVE_SELECTOR);
  if (nestedControl && nestedControl !== event.currentTarget) return;
  emit('open');
}

defineSlots<{
  actions(): unknown;
  supplement(): unknown;
}>();
</script>
