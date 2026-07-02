<template>
  <div class="relative">
    <button
      type="button"
      :class="[supportClass, compact ? '!h-8 !px-2.5 !gap-1 text-xs' : '']"
      :disabled="busy || supportClosed"
      :title="supportClosed ? (statusLabel ? `此提案目前為「${statusLabel}」狀態，不開放附議` : '附議已截止') : optimisticSupported ? '取消附議' : '進行附議'"
      :aria-label="optimisticSupported ? '取消附議' : '進行附議'"
      @click="toggle"
    >
      <!-- ThumbsUp Icon -->
      <svg
        v-if="!busy"
        xmlns="http://www.w3.org/2000/svg"
        :class="compact ? 'h-4 w-4' : 'h-5 w-5'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M7 11v8a2 2 0 0 1 -2 2h-2a1 1 0 0 1 -1 -1v-7a1 1 0 0 1 1 -1h3a4 4 0 0 0 4 -4v-1a2 2 0 0 1 4 0v5h3a2 2 0 0 1 2 2l-1 5a2 3 0 0 1 -2 2h-7a3 3 0 0 1 -3 -3" />
      </svg>
      <LoadingSpinner v-else :size="compact ? 4 : 5" class="text-ink-500 dark:text-ink-400" />
      <!-- Support count display -->
      <span class="text-sm font-semibold select-none leading-none">{{ displaySupportCount }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import { useVoteSupport } from '@/composables/useVoteSupport';

const props = defineProps<{
  issueId: string;
  currentUserSupported: boolean;
  supportCount: number;
  supportClosed: boolean;
  statusLabel?: string;
  compact?: boolean;
}>();

const emit = defineEmits<{
  contentUnavailable: [issueId: string];
  supported: [payload: { supported: boolean; supportCount: number }];
}>();

const supportClosed = computed(() => props.supportClosed);
const {
  busy,
  optimisticSupported,
  displaySupportCount,
  supportClass,
  toggle,
} = useVoteSupport({
  issueId: toRef(props, 'issueId'),
  currentUserSupported: toRef(props, 'currentUserSupported'),
  supportCount: toRef(props, 'supportCount'),
  supportClosed,
  statusLabel: computed(() => props.statusLabel),
  onSupported: (payload) => emit('supported', payload),
  onContentUnavailable: (issueId) => emit('contentUnavailable', issueId),
});
</script>
