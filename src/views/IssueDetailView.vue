<template>
  <div class="min-h-0">
    <DetailRouteState
      :allowed="isAllowedUser"
      :loading="sessionLoading || routeIssueLoading"
      loading-label="正在載入提案"
      :problem="sessionLoadingHasProblem"
      :problem-title="sessionProblemTitle"
      :problem-description="sessionProblemDescription"
      :problem-retry-disabled="!sessionOnline"
      @retry-problem="reloadPage"
    >
      <IssueDetailPagePanel
        v-if="routeIssue"
        :issue="routeIssue"
        :current-user-supported="Boolean(routeIssue.currentUserSupported)"
        :support-count="routeIssue.support_count"
        :support-closed="routeIssueSupportClosed"
        :initial-tab="initialTab"
        :focus-comment-id="focusCommentId"
        @back="goBackToIssueList"
        @content-unavailable="handleRouteIssueUnavailable"
        @delete="openDeleteDialog"
        @issue-updated="patchRouteIssue"
        @share="copyRouteIssueUrl"
        @supported="handleRouteIssueSupport"
      />
    </DetailRouteState>

    <ConfirmDialog
      :open="isDeleteDialogOpen"
      title="確定要刪除這筆提案嗎？"
      message="刪除後這筆提案將無法復原。"
      confirm-label="確認刪除"
      :busy="isDeleting"
      @cancel="closeDeleteDialog"
      @confirm="performRouteIssueDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import IssueDetailPagePanel from '@/components/IssueDetailPagePanel.vue';
import DetailRouteState from '@/components/ui/DetailRouteState.vue';
import { useDeleteIssue } from '@/composables/useDeleteIssue';
import { useAuthenticatedDetailState } from '@/composables/useAuthenticatedDetailState';
import { useIssueRouteDetail } from '@/composables/useIssueRouteDetail';
import { useSession } from '@/composables/useSession';
import { useShareUrl } from '@/composables/useShareUrl';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { normalizeIssueRouteFilterParam } from '@/constants/categories';
import { resetAppConnection } from '@/lib/reconnect';

const route = useRoute();
const router = useRouter();
const {
  canLoad,
  isAllowedUser,
  sessionLoading,
  sessionLoadingHasProblem,
  sessionOnline,
  sessionProblemDescription,
  sessionProblemTitle,
} = useAuthenticatedDetailState();
const { mySupportedIssueIds } = useSession();
const { copyShareUrl } = useShareUrl();
const { show } = useActionFeedback();

const {
  routeIssue,
  routeIssueLoading,
  routeIssueSupportClosed,
  closeRouteIssue,
  patchRouteIssue,
  updateRouteIssueSupport,
} = useIssueRouteDetail(mySupportedIssueIds, undefined, canLoad);

const routeIssueId = computed(() => routeIssue.value?.id ?? '');
const {
  isDeleteDialogOpen,
  isDeleting,
  actionError,
  confirmDelete: openDeleteDialog,
  closeDeleteDialog,
  performDelete,
} = useDeleteIssue(routeIssueId);

const initialTab = computed(() => route.query.tab === 'comments' ? 'comments' : 'details');
const focusCommentId = computed(() => {
  const value = route.query.comment;
  return typeof value === 'string' ? value : '';
});

function goBackToIssueList() {
  closeRouteIssue();
}

function copyRouteIssueUrl() {
  if (!routeIssue.value) return;
  const href = router.resolve({
    name: 'issue-detail',
    params: {
      filter: normalizeIssueRouteFilterParam(route.params.filter),
      issueId: routeIssue.value.id,
    },
  }).href;
  copyShareUrl(new URL(href, window.location.origin).toString());
}

async function performRouteIssueDelete() {
  const deletedIssueId = await performDelete();
  if (actionError.value) {
    return;
  }

  if (!deletedIssueId) return;
  closeDeleteDialog();
  closeRouteIssue();
}

function handleRouteIssueSupport(payload: { supported: boolean; supportCount: number }) {
  updateRouteIssueSupport(payload.supported, payload.supportCount);
}

function handleRouteIssueUnavailable() {
  closeRouteIssue();
}

async function reloadPage() {
  await resetAppConnection();
  window.location.reload();
}
</script>
