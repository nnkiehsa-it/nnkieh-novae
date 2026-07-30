<template>
  <ContentCardCollection
    :empty="issues.length === 0"
    empty-label="issue.noProposalsYet"
    :error="error"
    list-label="issue.proposalList"
    :loading="loading"
  >
    <template #loading>
      <ContentCardSkeleton
        :action-shapes="['icon', 'pill']"
        :count="loadingCount"
        loading-label="issue.proposalLoading"
        :show-admin="isAdmin"
        :show-author="showAuthor"
        supplement="progress"
      />
    </template>

    <AnimatePresence :initial="false">
      <m.div
        v-for="issue in issues"
        :key="issue.id"
        layout
        :initial="{ opacity: 0, y: 16, scale: 0.985 }"
        :animate="{ opacity: 1, y: 0, scale: 1 }"
        :exit="{ opacity: 0, y: -10, scale: 0.985 }"
        :transition="listMotionTransition"
      >
        <IssueTableRow
          :issue="issue"
          :highlight-query="highlightQuery"
          @detail-intent="emit('detail-intent', $event)"
          @open-details="emit('open-details', $event)"
          @support-changed="emit('support-changed', $event)"
          @issue-updated="emit('issue-updated', $event)"
          @issue-deleted="emit('issue-deleted', $event)"
        />
      </m.div>
    </AnimatePresence>
  </ContentCardCollection>
</template>

<script setup lang="ts">
import IssueTableRow from './IssueTableRow.vue';
import ContentCardCollection from '@/components/ui/organisms/ContentCardCollection.vue';
import ContentCardSkeleton from '@/components/ui/organisms/ContentCardSkeleton.vue';
import { AnimatePresence, m } from 'motion-v';
import { useSession } from '@/composables/useSession';
import type { IssueRecord } from '@/types';
import { MOTION_SMOOTH_SPRING, MOTION_SMOOTH_TWEEN } from '@/lib/ui-motion';

withDefaults(defineProps<{
  issues: IssueRecord[];
  loading: boolean;
  loadingCount?: number;
  error: string;
  showAuthor?: boolean;
  highlightQuery?: string;
}>(), {
  loadingCount: 2,
  showAuthor: true,
  highlightQuery: '',
});

const emit = defineEmits<{
  'detail-intent': [issue: IssueRecord];
  'support-changed': [payload: { issueId: string; supported: boolean; supportCount: number }];
  'open-details': [payload: { issue: IssueRecord; initialTab: 'details' | 'comments' }];
  'issue-updated': [issue: IssueRecord];
  'issue-deleted': [issueId: string];
}>();

const { isAdmin } = useSession();
const listMotionTransition = {
  layout: MOTION_SMOOTH_SPRING,
  opacity: MOTION_SMOOTH_TWEEN,
  scale: MOTION_SMOOTH_TWEEN,
  y: MOTION_SMOOTH_TWEEN,
};
</script>
