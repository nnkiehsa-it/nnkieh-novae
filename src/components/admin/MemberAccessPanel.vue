<template>
  <section class="space-y-5" aria-labelledby="member-access-title">
    <SectionHeader
      id="member-access-title"
      :title="t('adminCenter.memberSectionTitle')"
      :description="t('adminCenter.memberSectionDescription')"
    />

    <SurfacePanel padding="lg" class="space-y-5">
      <WorkflowStepHeader
        :step="1"
        :title="t('adminCenter.chooseResponsibilityStep')"
        :description="t('adminCenter.chooseResponsibilityHelp')"
      />

      <div class="grid gap-3 md:grid-cols-3" role="group" :aria-label="t('adminCenter.chooseResponsibilityStep')">
        <SelectionOptionButton
          v-for="option in scopeOptions"
          :key="option.value"
          :label="option.label"
          :description="option.description"
          :selected="scopeKind === option.value"
          :disabled="Boolean(savingUid)"
          @select="scopeKind = option.value"
        />
      </div>

      <div v-if="scopeKind === 'issue' || scopeKind === 'facility'" class="space-y-2">
        <p class="text-xs font-semibold text-ink-700 dark:text-ink-300">{{ t('adminCenter.chooseCategoryPrompt') }}</p>
        <div class="grid gap-2 sm:grid-cols-2" role="group" :aria-label="t('adminCenter.chooseCategoryPrompt')">
          <SelectionOptionButton
            v-for="category in selectableCategories"
            :key="category.id"
            :label="category.label"
            :description="categoryDescription(category.label)"
            :selected="selectedCategoryId === category.id"
            :disabled="Boolean(savingUid)"
            @select="selectedCategoryId = category.id"
          />
        </div>
      </div>
      <EmptyStatePanel
        v-if="(scopeKind === 'issue' || scopeKind === 'facility') && selectableCategories.length === 0"
        title="categoryAdmin.noCategoriesAvailable"
        description="adminCenter.noAssignableCategoriesHelp"
        icon="warning"
      />

      <div
        v-if="scopeReady"
        ref="memberDirectory"
        class="scroll-mt-24 space-y-4 border-t border-ink-100 pt-5 focus:outline-none dark:border-ink-800"
        tabindex="-1"
        aria-labelledby="current-assignees-title"
      >
        <WorkflowStepHeader
          title-id="current-assignees-title"
          :step="2"
          :title="t('adminCenter.currentAssigneesStep')"
          :description="t('adminCenter.currentAssigneesCount', { count: assignees.length, scope: selectedScopeLabel })"
        />

        <MemberAccessListSkeleton
          v-if="membersLoading"
          :loading-label="t('common.loading')"
          :count="2"
        />
        <InlineMessage v-else-if="memberError" tone="error">{{ t(memberError) }}</InlineMessage>
        <InlineMessage v-if="membersTruncated" tone="warning">{{ t('adminCenter.memberListTruncated') }}</InlineMessage>
        <EmptyStatePanel
          v-if="!membersLoading && !memberError && assignees.length === 0"
          title="adminCenter.noCurrentAssignees"
          description="adminCenter.noCurrentAssigneesHelp"
          icon="lock"
        />
        <SurfacePanel v-else-if="!membersLoading && assignees.length" variant="list">
          <MemberAccessRow
            v-for="assignee in assignees"
            :key="assignee.uid"
            :member="assignee"
            :summary="accessSummary(assignee)"
            :action-label="t('adminCenter.removeAccess')"
            :busy-label="t('common.saving')"
            action-variant="danger"
            :busy="savingUid === assignee.uid"
            :disabled="Boolean(savingUid)"
            @action="revokeAssignee(assignee)"
          />
        </SurfacePanel>
      </div>

      <div v-if="scopeReady" class="space-y-4 border-t border-ink-100 pt-5 dark:border-ink-800">
        <WorkflowStepHeader
          title-id="find-member-title"
          :step="3"
          :title="t('adminCenter.findMemberStep')"
          :description="t('adminCenter.findMemberHelp')"
        />
        <div class="flex flex-col gap-2 sm:flex-row">
          <input
            id="access-member-lookup"
            v-model="memberLookup"
            type="search"
            class="field min-w-0 flex-1"
            autocomplete="off"
            :aria-labelledby="'find-member-title'"
            :placeholder="t('adminCenter.lookupMemberPlaceholder')"
            :disabled="Boolean(savingUid)"
            @keydown.enter.prevent="lookupMember(memberLookup)"
          />
          <AppButton
            variant="secondary"
            class="shrink-0"
            :disabled="!canLookup || Boolean(savingUid)"
            @click="lookupMember(memberLookup)"
          >
            <BusyButtonContent
              :busy="lookupLoading"
              :label="t('adminCenter.lookupMember')"
              :busy-label="t('common.loading')"
            />
          </AppButton>
        </div>

        <MemberAccessListSkeleton
          v-if="lookupLoading"
          :loading-label="t('common.loading')"
        />
        <InlineMessage v-else-if="lookupError" tone="error">{{ t(lookupError) }}</InlineMessage>
        <EmptyStatePanel
          v-else-if="lookupAttempted && !lookupCandidate"
          title="adminCenter.noMatchingMembers"
          description="adminCenter.noMatchingMembersHelp"
          icon="inbox"
        />
        <EmptyStatePanel
          v-else-if="!lookupAttempted"
          title="adminCenter.noMemberSelected"
          description="adminCenter.noMemberSelectedHelp"
          icon="inbox"
        />
        <SurfacePanel v-else-if="lookupCandidate" variant="list">
          <MemberAccessRow
            :member="lookupCandidate"
            :summary="accessSummary(lookupCandidate)"
            :status-label="t(userHasSelectedAccess(lookupCandidate) ? 'adminCenter.accessAlreadyGranted' : 'adminCenter.accessNotGranted')"
            :status-tone="userHasSelectedAccess(lookupCandidate) ? 'success' : 'muted'"
            :action-label="t(userHasSelectedAccess(lookupCandidate) ? 'adminCenter.removeAccess' : 'adminCenter.grantAccess')"
            :busy-label="t('common.saving')"
            :action-variant="userHasSelectedAccess(lookupCandidate) ? 'danger' : 'primary'"
            :busy="savingUid === lookupCandidate.uid"
            :disabled="Boolean(savingUid)"
            @action="userHasSelectedAccess(lookupCandidate) ? revokeAssignee(lookupCandidate) : grantCandidate(lookupCandidate)"
          />
        </SurfacePanel>
      </div>

      <p class="sr-only" aria-live="polite">{{ memberDirectoryStatus }}</p>
    </SurfacePanel>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import MemberAccessListSkeleton from '@/components/admin/MemberAccessListSkeleton.vue';
import MemberAccessRow from '@/components/admin/MemberAccessRow.vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import BusyButtonContent from '@/components/ui/atoms/BusyButtonContent.vue';
import InlineMessage from '@/components/ui/atoms/InlineMessage.vue';
import EmptyStatePanel from '@/components/ui/molecules/EmptyStatePanel.vue';
import SectionHeader from '@/components/ui/molecules/SectionHeader.vue';
import SelectionOptionButton from '@/components/ui/molecules/SelectionOptionButton.vue';
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';
import WorkflowStepHeader from '@/components/ui/molecules/WorkflowStepHeader.vue';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { useCategories } from '@/composables/useCategories';
import { useMemberAccessManagement } from '@/composables/useMemberAccessManagement';
import { useI18n } from '@/i18n';
import type { AccessScope, AccessUser } from '@/services/access';

type AccessScopeKind = AccessScope['kind'];

const { t } = useI18n();
const { activeFacilityCategories, activeIssueCategories, refresh } = useCategories();
const { show } = useActionFeedback();
const scopeKind = ref<AccessScopeKind>('issue');
const selectedCategoryId = ref('');
const memberLookup = ref('');
const memberDirectory = ref<HTMLElement | null>(null);

const scopeOptions = computed(() => [
  { value: 'issue' as const, label: t('adminCenter.proposalResponsibility'), description: t('adminCenter.proposalResponsibilityHelp') },
  { value: 'facility' as const, label: t('adminCenter.facilityResponsibility'), description: t('adminCenter.facilityResponsibilityHelp') },
  { value: 'announcement' as const, label: t('access.announcementManagement'), description: t('access.publishAndDeleteAnnouncements') },
]);
const selectableCategories = computed(() => scopeKind.value === 'issue'
  ? activeIssueCategories.value
  : scopeKind.value === 'facility' ? activeFacilityCategories.value : []);
const scopeReady = computed(() => scopeKind.value === 'announcement' || Boolean(selectedCategoryId.value));
const selectedAccessScope = computed<AccessScope | null>(() => {
  if (scopeKind.value === 'issue' || scopeKind.value === 'facility') {
    return selectedCategoryId.value ? { kind: scopeKind.value, categoryId: selectedCategoryId.value } : null;
  }
  return { kind: scopeKind.value };
});
const selectedCategory = computed(() => selectableCategories.value.find((category) => category.id === selectedCategoryId.value));
const selectedScopeLabel = computed(() => selectedCategory.value?.label ?? t('access.announcementManagement'));
const canLookup = computed(() => memberLookup.value.trim().length > 0);

const {
  assignees,
  grantAccess,
  lookupAttempted,
  lookupCandidate,
  lookupError,
  lookupLoading,
  lookupMember,
  memberError,
  membersLoading,
  membersTruncated,
  resetLookup,
  revokeAccess,
  savingUid,
} = useMemberAccessManagement(selectedAccessScope);

function userHasSelectedAccess(accessUser: AccessUser) {
  if (scopeKind.value === 'issue') return accessUser.managedIssueCategoryIds.includes(selectedCategoryId.value);
  if (scopeKind.value === 'facility') return accessUser.managedFacilityCategoryIds.includes(selectedCategoryId.value);
  return accessUser.roles.includes('announcement-manager');
}

const memberDirectoryStatus = computed(() => scopeReady.value
  ? t('adminCenter.memberDirectoryStatus', {
    assigned: assignees.value.length,
    available: lookupCandidate.value && !userHasSelectedAccess(lookupCandidate.value) ? 1 : 0,
  })
  : '');

function categoryDescription(label: string) {
  return scopeKind.value === 'issue'
    ? t('access.reviewAndManageProposalsInCategory', { category: label })
    : t('access.handleFacilityReportsInCategory', { category: label });
}

function accessSummary(accessUser: AccessUser) {
  const count = accessUser.roles.filter((role) => role !== 'platform-admin').length
    + accessUser.managedIssueCategoryIds.length
    + accessUser.managedFacilityCategoryIds.length;
  return t('adminCenter.scopedAccessSummary', { count });
}

async function focusMemberDirectory() {
  await nextTick();
  memberDirectory.value?.focus({ preventScroll: true });
  memberDirectory.value?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  });
}

async function grantCandidate(accessUser: AccessUser) {
  if (await grantAccess(accessUser)) show(t('adminCenter.accessSaved'), 'success');
}

async function revokeAssignee(accessUser: AccessUser) {
  if (await revokeAccess(accessUser)) show(t('adminCenter.accessSaved'), 'success');
}

watch(scopeKind, () => {
  selectedCategoryId.value = '';
  memberLookup.value = '';
  resetLookup();
});
watch(selectableCategories, (categories) => {
  if ((scopeKind.value === 'issue' || scopeKind.value === 'facility')
    && !selectedCategoryId.value && categories.length === 1) {
    selectedCategoryId.value = categories[0]?.id ?? '';
  }
}, { immediate: true });
watch(selectedAccessScope, (scope) => {
  memberLookup.value = '';
  if (scope) void focusMemberDirectory();
});

onMounted(refresh);
</script>
