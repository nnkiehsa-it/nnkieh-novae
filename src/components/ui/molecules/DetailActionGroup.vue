<template>
  <component
    :is="summary ? SurfacePanel : 'div'"
    :variant="summary ? 'inset' : undefined"
    class="mt-4 shrink-0"
    :class="summary
      ? 'space-y-4 p-4'
      : compact
        ? 'space-y-3 px-1 pb-1 pt-3'
        : 'space-y-3 pb-1 pt-3'"
  >
    <slot name="header" />

    <div class="flex flex-wrap items-center gap-2">
      <slot name="primary" />

      <DetailActionButton
        v-if="showShare"
        label="common.share"
        :compact="compact"
        title="common.shareLink"
        aria-label="common.shareLink"
        @click="emit('share')"
      >
        <AppIcon name="share" />
      </DetailActionButton>

      <slot />

      <DetailActionButton
        v-if="showDelete"
        danger
        :label="deleteLabel"
        :compact="compact"
        :title="deleteTitle"
        :aria-label="deleteTitle"
        @click="emit('delete')"
      >
        <AppIcon name="trash" />
      </DetailActionButton>
    </div>

    <div
      v-if="operationTimeItems.length > 0"
      :class="summary ? 'border-t border-ink-200/70 pt-3 dark:border-ink-700/70' : ''"
    >
      <OperationTimeList :items="operationTimeItems" :compact="compact" />
    </div>
  </component>
</template>

<script setup lang="ts">
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import DetailActionButton from '@/components/ui/molecules/DetailActionButton.vue';
import OperationTimeList from '@/components/ui/molecules/OperationTimeList.vue';
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';
import type { OperationTimeListItem } from '@/types';

withDefaults(defineProps<{
  compact?: boolean;
  deleteLabel?: string;
  deleteTitle?: string;
  operationTimeItems?: OperationTimeListItem[];
  showDelete?: boolean;
  showShare?: boolean;
  summary?: boolean;
}>(), {
  compact: false,
  deleteLabel: 'common.delete',
  deleteTitle: 'common.delete',
  operationTimeItems: () => [],
  showDelete: false,
  showShare: true,
  summary: false,
});

const emit = defineEmits<{
  delete: [];
  share: [];
}>();

defineSlots<{
  default(): unknown;
  header(): unknown;
  primary(): unknown;
}>();
</script>
