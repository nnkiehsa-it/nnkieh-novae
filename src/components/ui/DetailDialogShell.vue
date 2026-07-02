<template>
  <DialogOverlay :open="open" no-padding transition-name="detail-dialog" @close="emit('close')">
    <section
      ref="dialogRef"
      class="panel relative flex h-full w-full flex-col overflow-hidden rounded-none border-none px-4 pt-4 md:p-7"
      data-dialog-root
      data-detail-dialog-root
      tabindex="-1"
    >
      <header data-detail-dialog-header class="flex shrink-0 items-center justify-between gap-3 pb-1 md:pb-3">
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <slot name="header" />
        </div>
        <button
          type="button"
          class="button-icon-filled shrink-0"
          :aria-label="closeLabel"
          :title="closeLabel"
          data-autofocus
          @click="emit('close')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div v-if="isDesktopViewport" class="hidden min-h-0 flex-1 md:flex">
        <div data-detail-dialog-main class="flex h-full min-h-0 w-[62%] flex-col pr-6">
          <slot name="details" :compact="false" :scroll-content="true" />
          <slot name="actions" :compact="false" />
        </div>
        <div data-detail-dialog-aside class="flex h-full min-h-0 w-[38%] flex-col border-l border-ink-100 pl-6 pr-1 dark:border-ink-800">
          <slot name="comments" :compact-header="false" />
        </div>
      </div>

      <div v-else class="flex min-h-0 flex-1 flex-col overflow-hidden md:hidden">
        <div data-detail-dialog-tabs class="mb-1 flex shrink-0 justify-center">
          <SegmentedControl
            :model-value="activeTab"
            :options="tabOptions"
            @update:model-value="setActiveTab"
          />
        </div>

        <div data-detail-dialog-main class="flex min-h-0 flex-1 flex-col px-1">
          <div v-show="activeTab === 'details'" class="flex h-full min-h-0 flex-1 flex-col">
            <div class="min-h-0 flex-1 overflow-y-auto px-1 pb-3 pr-2">
              <slot name="details" :compact="true" :scroll-content="false" />
            </div>
            <slot name="actions" :compact="true" />
          </div>

          <div v-show="activeTab === 'comments'" class="min-h-0 flex-1">
            <slot name="comments" :compact-header="true" />
          </div>
        </div>
      </div>
    </section>
  </DialogOverlay>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue';
import SegmentedControl from '@/components/SegmentedControl.vue';
import DialogOverlay from '@/components/ui/DialogOverlay.vue';
import { useBodyScrollLock } from '@/composables/useBodyScrollLock';
import { useDialogFocus } from '@/composables/useDialogFocus';

type DetailDialogTab = 'details' | 'comments';

const props = withDefaults(defineProps<{
  closeLabel?: string;
  commentsLabel?: string;
  detailsLabel: string;
  initialTab?: DetailDialogTab;
  open: boolean;
}>(), {
  closeLabel: '關閉',
  commentsLabel: '討論留言',
  initialTab: 'details',
});

const emit = defineEmits<{
  close: [];
}>();

defineSlots<{
  actions(props: { compact: boolean }): unknown;
  comments(props: { compactHeader: boolean }): unknown;
  details(props: { compact: boolean; scrollContent: boolean }): unknown;
  header(): unknown;
}>();

const activeTab = ref<DetailDialogTab>('details');
const isDesktopViewport = ref(
  typeof window === 'undefined' ? false : window.matchMedia('(min-width: 768px)').matches,
);
let desktopMediaQuery: MediaQueryList | null = null;
const tabOptions = computed(() => [
  { value: 'details', label: props.detailsLabel },
  { value: 'comments', label: props.commentsLabel },
]);

useBodyScrollLock(toRef(props, 'open'));
const { dialogRef } = useDialogFocus(toRef(props, 'open'), {
  onClose: () => emit('close'),
});

watch(
  () => props.open,
  (open) => {
    if (open) {
      activeTab.value = props.initialTab;
    }
  },
  { immediate: true },
);

function syncDesktopViewport(event?: MediaQueryListEvent) {
  isDesktopViewport.value = event?.matches ?? desktopMediaQuery?.matches ?? window.innerWidth >= 768;
}

function setActiveTab(value: string) {
  if (value === 'details' || value === 'comments') {
    activeTab.value = value;
  }
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
