<template>
  <div class="relative">
    <AppButton
      v-if="compact"
      :variant="supportVariant"
      :state="phase"
      class="button-card-count"
      :disabled="busy || supportClosed || authorFixed"
      :title="supportTitle"
      :aria-label="t(authorFixed ? 'issue.theAuthorAutomaticallySupportsThisProposal' : optimisticSupported ? 'common.removeSupport' : 'issue.supportProposal')"
      @click="toggle"
    >
      <AppIcon name="thumbs-up" :size="4" />
      <span class="select-none text-[11px] font-semibold leading-none">{{ displaySupportCount }}</span>
    </AppButton>

    <DetailActionButton
      v-else
      :active="optimisticSupported"
      :disabled="busy || supportClosed || authorFixed"
      :busy="busy"
      :state="phase"
      :label="String(displaySupportCount)"
      :title="supportTitle"
      :aria-label="authorFixed ? 'issue.theAuthorAutomaticallySupportsThisProposal' : optimisticSupported ? 'common.removeSupport' : 'issue.supportProposal'"
      @click="toggle"
    >
      <AppIcon name="thumbs-up" />
    </DetailActionButton>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import DetailActionButton from '@/components/ui/molecules/DetailActionButton.vue';
import { useVoteSupport } from '@/composables/useVoteSupport';
import { useI18n } from '@/i18n';

const props = defineProps<{
  issueId: string;
  currentUserSupported: boolean;
  supportCount: number;
  supportClosed: boolean;
  statusLabel?: string;
  compact?: boolean;
  authorFixed?: boolean;
}>();

const emit = defineEmits<{
  contentUnavailable: [issueId: string];
  supported: [payload: { supported: boolean; supportCount: number }];
}>();
const { t } = useI18n();
const supportClosed = computed(() => props.supportClosed);
const {
  busy,
  phase,
  optimisticSupported,
  displaySupportCount,
  supportVariant,
  toggle,
} = useVoteSupport({
  issueId: toRef(props, 'issueId'),
  authorFixed: computed(() => props.authorFixed === true),
  currentUserSupported: toRef(props, 'currentUserSupported'),
  supportCount: toRef(props, 'supportCount'),
  supportClosed,
  statusLabel: computed(() => props.statusLabel),
  onSupported: (payload) => emit('supported', payload),
  onContentUnavailable: (issueId) => emit('contentUnavailable', issueId),
});
const supportTitle = computed(() => {
  if (props.authorFixed) return t('issue.theAuthorAutomaticallySupportsThisProposal');
  if (!props.supportClosed) return t(optimisticSupported.value ? 'common.removeSupport' : 'issue.supportProposal');
  return props.statusLabel
    ? t('issue.support.closedStatus', { status: props.statusLabel })
    : t('issue.submissionsHaveEnded');
});
</script>
