<template>
  <div :data-panel-key="panelKey" :class="spacingClass">
    <PageLoadFailure
      v-if="loadingHasProblem"
      :title="problemTitle"
      :description="problemDescription"
      :retry-disabled="retryDisabled"
      @retry="emit('retry')"
    />

    <slot v-else-if="loading" name="loading" />

    <EmptyStatePanel
      v-else-if="unavailable"
      :title="unavailableTitle"
      :description="unavailableDescription"
      :icon="unavailableIcon"
    />

    <EmptyStatePanel
      v-else-if="error && empty"
      :title="errorTitle"
      :description="error"
      icon="warning"
      tone="danger"
      action-label="dashboard.refresh"
      @action="emit('retry')"
    />

    <EmptyStatePanel
      v-else-if="empty"
      :title="emptyTitle"
      :description="emptyDescription"
      :icon="emptyIcon"
    />

    <template v-else>
      <slot />

      <InlineAlert v-if="error" tone="error">
        {{ error }}
      </InlineAlert>
      <slot
        v-if="loadingMore"
        name="loading-more"
        :count="LOAD_MORE_PLACEHOLDER_COUNT"
      />
      <FeedLoadMoreControl
        v-show="!loadingMore"
        :has-more="hasMore"
        :loading="loadingMore"
        :error="Boolean(error)"
        @load-more="emit('loadMore')"
      />
      <slot name="sentinel" />
    </template>
  </div>
</template>

<script setup lang="ts">
import EmptyStatePanel from '@/components/ui/molecules/EmptyStatePanel.vue';
import InlineAlert from '@/components/ui/atoms/InlineAlert.vue';
import FeedLoadMoreControl from '@/components/ui/molecules/FeedLoadMoreControl.vue';
import PageLoadFailure from '@/components/ui/molecules/PageLoadFailure.vue';
import { LOAD_MORE_PLACEHOLDER_COUNT } from '@/lib/feed-loading';

type EmptyStateIcon = 'chart' | 'comment' | 'lock' | 'warning' | 'inbox';

withDefaults(defineProps<{
  empty: boolean;
  emptyDescription?: string;
  emptyIcon?: EmptyStateIcon;
  emptyTitle: string;
  error?: string;
  errorTitle: string;
  hasMore?: boolean;
  loading: boolean;
  loadingHasProblem: boolean;
  loadingMore?: boolean;
  panelKey: string;
  problemDescription: string;
  problemTitle: string;
  retryDisabled?: boolean;
  spacingClass?: string;
  unavailable?: boolean;
  unavailableDescription?: string;
  unavailableIcon?: EmptyStateIcon;
  unavailableTitle?: string;
}>(), {
  emptyDescription: '',
  emptyIcon: 'inbox',
  error: '',
  hasMore: false,
  loadingMore: false,
  retryDisabled: false,
  spacingClass: 'space-y-4',
  unavailable: false,
  unavailableDescription: '',
  unavailableIcon: 'lock',
  unavailableTitle: '',
});

const emit = defineEmits<{
  loadMore: [];
  retry: [];
}>();

defineSlots<{
  default(): unknown;
  loading(): unknown;
  'loading-more'(props: { count: number }): unknown;
  sentinel(): unknown;
}>();
</script>
