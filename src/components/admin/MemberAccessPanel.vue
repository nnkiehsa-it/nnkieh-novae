<template>
  <section class="space-y-5" aria-labelledby="member-access-title">
    <SectionHeader
      id="member-access-title"
      :title="t('adminCenter.memberSectionTitle')"
      :description="t('adminCenter.memberSectionDescription')"
    />

    <SurfacePanel padding="lg" class="space-y-5">
      <div class="flex items-start gap-3">
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-white dark:bg-ink-50 dark:text-ink-950">1</span>
        <div class="min-w-0 flex-1">
          <h3 class="text-sm font-bold text-ink-950 dark:text-ink-50">{{ t('adminCenter.chooseResponsibilityStep') }}</h3>
          <p class="mt-1 text-xs leading-5 text-ink-500">{{ t('adminCenter.chooseResponsibilityHelp') }}</p>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-3" role="group" :aria-label="t('adminCenter.chooseResponsibilityStep')">
        <SelectionOptionButton
          v-for="option in scopeOptions"
          :key="option.value"
          :label="option.label"
          :description="option.description"
          :selected="scopeKind === option.value"
          @select="scopeKind = option.value"
        />
      </div>

      <div v-if="scopeKind === 'issue' || scopeKind === 'facility'" class="grid gap-2 sm:grid-cols-2">
        <SelectionOptionButton
          v-for="category in selectableCategories"
          :key="category.id"
          :label="category.label"
          :description="categoryDescription(category.label)"
          :selected="selectedCategoryId === category.id"
          :disabled="loading || Boolean(savingUid)"
          @select="selectedCategoryId = category.id"
        />
      </div>
      <EmptyStatePanel
        v-if="(scopeKind === 'issue' || scopeKind === 'facility') && selectableCategories.length === 0"
        title="categoryAdmin.noCategoriesAvailable"
        description="adminCenter.noAssignableCategoriesHelp"
        icon="warning"
      />
    </SurfacePanel>

    <SurfacePanel v-if="scopeReady" padding="lg" class="space-y-4">
      <div class="flex items-start gap-3">
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-white dark:bg-ink-50 dark:text-ink-950">2</span>
        <div class="min-w-0 flex-1">
          <h3 class="text-sm font-bold text-ink-950 dark:text-ink-50">{{ t('adminCenter.currentAssigneesStep') }}</h3>
          <p class="mt-1 text-xs leading-5 text-ink-500">
            {{ t('adminCenter.currentAssigneesCount', { count: assignees.length, scope: selectedScopeLabel }) }}
          </p>
        </div>
      </div>

      <InlineMessage v-if="assigneesLoading">{{ t('common.loading') }}</InlineMessage>
      <InlineMessage v-else-if="assigneeError" tone="error">{{ assigneeError }}</InlineMessage>
      <InlineMessage v-if="assigneesTruncated" tone="warning">{{ t('adminCenter.assigneeListTruncated') }}</InlineMessage>
      <EmptyStatePanel
        v-if="!assigneesLoading && !assigneeError && assignees.length === 0"
        title="adminCenter.noCurrentAssignees"
        description="adminCenter.noCurrentAssigneesHelp"
        icon="lock"
      />
      <SurfacePanel v-else-if="assignees.length" variant="list">
        <ListSurfaceRow v-for="assignee in assignees" :key="assignee.uid" as="div" class="flex flex-wrap items-center gap-3">
          <UserAvatar :photo-url="assignee.photoUrl" :name="assignee.name" size="md" />
          <div class="min-w-0 flex-1">
            <h4 class="truncate text-sm font-bold text-ink-900 dark:text-ink-100">{{ assignee.name }}</h4>
            <p class="mt-0.5 truncate text-xs text-ink-500">{{ assignee.email || assignee.uid }}</p>
            <p class="mt-1 text-xs text-ink-500">{{ accessSummary(assignee) }}</p>
          </div>
          <div class="flex shrink-0 gap-2">
            <AppButton size="sm" variant="secondary" :disabled="Boolean(savingUid)" @click="selectAssignee(assignee)">
              {{ t('common.manage') }}
            </AppButton>
            <AppButton
              size="sm"
              variant="danger"
              :disabled="Boolean(savingUid)"
              @click="revokeAssignee(assignee)"
            >
              <BusyButtonContent
                :busy="savingUid === assignee.uid"
                :label="t('adminCenter.removeAccess')"
                :busy-label="t('common.saving')"
              />
            </AppButton>
          </div>
        </ListSurfaceRow>
      </SurfacePanel>
    </SurfacePanel>

    <SurfacePanel v-if="scopeReady" as="form" padding="lg" @submit.prevent="findUser">
      <div class="flex items-start gap-3">
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-white dark:bg-ink-50 dark:text-ink-950">3</span>
        <div class="min-w-0 flex-1">
          <label for="access-user-lookup" class="block text-sm font-bold text-ink-950 dark:text-ink-50">
            {{ t('adminCenter.findMemberStep') }}
          </label>
          <p class="mt-1 text-xs leading-5 text-ink-500">{{ t('adminCenter.findMemberHelp') }}</p>
          <div class="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              id="access-user-lookup"
              v-model="lookup"
              class="field min-w-0 flex-1"
              autocomplete="off"
              inputmode="email"
              :placeholder="t('access.enterYourCampusEmailOrUid')"
              :disabled="loading || Boolean(savingUid)"
            />
            <AppButton type="submit" variant="primary" class="shrink-0" :disabled="loading || Boolean(savingUid) || !lookup.trim()">
              <BusyButtonContent :busy="loading" :label="t('access.find')" :busy-label="t('access.searching')" />
            </AppButton>
          </div>
        </div>
      </div>
    </SurfacePanel>

    <EmptyStatePanel v-if="error && !user" title="access.unableToFindUser" :description="error" icon="warning" />

    <SurfacePanel v-else-if="user && scopeReady" as="article" padding="lg" class="space-y-5">
      <div class="flex items-start gap-3">
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-white dark:bg-ink-50 dark:text-ink-950">4</span>
        <div class="min-w-0 flex-1">
          <h3 class="text-sm font-bold text-ink-950 dark:text-ink-50">{{ t('adminCenter.confirmAssignmentStep') }}</h3>
          <p class="mt-1 text-xs leading-5 text-ink-500">{{ selectedScopeLabel }}</p>
        </div>
      </div>

      <ListSurfaceRow as="div" class="flex items-center gap-3">
        <UserAvatar :photo-url="user.photoUrl" :name="user.name" size="md" />
        <div class="min-w-0 flex-1">
          <h2 class="truncate text-base font-bold text-ink-900 dark:text-ink-100">{{ user.name }}</h2>
          <p class="mt-0.5 truncate text-xs text-ink-500">{{ user.email || user.uid }}</p>
          <p class="mt-2 text-xs font-semibold" :class="hasSelectedAccess ? 'text-primary-700 dark:text-primary-300' : 'text-ink-500'">
            {{ accessStateLabel }}
          </p>
        </div>
      </ListSurfaceRow>

      <InlineMessage v-if="error">{{ error }}</InlineMessage>

      <div class="flex flex-col-reverse gap-2 border-t border-ink-100 pt-5 dark:border-ink-800 sm:flex-row sm:justify-end">
        <AppButton variant="secondary" :disabled="Boolean(savingUid)" @click="clearUser">
          {{ t('adminCenter.chooseAnotherMember') }}
        </AppButton>
        <AppButton
          :variant="hasSelectedAccess ? 'danger' : 'primary'"
          :disabled="Boolean(savingUid)"
          @click="saveSelectedAccess(!hasSelectedAccess)"
        >
          <BusyButtonContent
            :busy="Boolean(savingUid)"
            :label="hasSelectedAccess ? t('adminCenter.removeAccess') : t('adminCenter.grantAccess')"
            :busy-label="t('common.saving')"
          />
        </AppButton>
      </div>
    </SurfacePanel>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import BusyButtonContent from '@/components/ui/atoms/BusyButtonContent.vue';
import InlineMessage from '@/components/ui/atoms/InlineMessage.vue';
import UserAvatar from '@/components/ui/atoms/UserAvatar.vue';
import EmptyStatePanel from '@/components/ui/molecules/EmptyStatePanel.vue';
import ListSurfaceRow from '@/components/ui/molecules/ListSurfaceRow.vue';
import SectionHeader from '@/components/ui/molecules/SectionHeader.vue';
import SelectionOptionButton from '@/components/ui/molecules/SelectionOptionButton.vue';
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { useCategories } from '@/composables/useCategories';
import { useI18n } from '@/i18n';
import {
  findRoleAssignment,
  listScopeAssignments,
  setUserRoles,
  type AccessScope,
  type AccessUser,
} from '@/services/access';
import type { RoleCode } from '@/services/session-role';

type AccessScopeKind = 'issue' | 'facility' | 'announcement';

const { t } = useI18n();
const { activeFacilityCategories, activeIssueCategories, refresh } = useCategories();
const { show } = useActionFeedback();
const scopeKind = ref<AccessScopeKind>('issue');
const selectedCategoryId = ref('');
const lookup = ref('');
const user = ref<AccessUser | null>(null);
const loading = ref(false);
const savingUid = ref('');
const error = ref('');
const assignees = ref<AccessUser[]>([]);
const assigneesLoading = ref(false);
const assigneesTruncated = ref(false);
const assigneeError = ref('');
let assigneeRequestSequence = 0;

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
const selectedScopeLabel = computed(() => selectedCategory.value?.label
  ?? t('access.announcementManagement'));

function userHasSelectedAccess(accessUser: AccessUser) {
  if (scopeKind.value === 'issue') return accessUser.managedIssueCategoryIds.includes(selectedCategoryId.value);
  if (scopeKind.value === 'facility') return accessUser.managedFacilityCategoryIds.includes(selectedCategoryId.value);
  return accessUser.roles.includes('announcement-manager');
}

const hasSelectedAccess = computed(() => Boolean(user.value && userHasSelectedAccess(user.value)));

const accessStateLabel = computed(() => hasSelectedAccess.value
  ? t('adminCenter.accessAlreadyGranted')
  : t('adminCenter.accessNotGranted'));

function categoryDescription(label: string) {
  return scopeKind.value === 'issue'
    ? t('access.reviewAndManageProposalsInCategory', { category: label })
    : t('access.handleFacilityReportsInCategory', { category: label });
}

function clearUser() {
  user.value = null;
  error.value = '';
}

function accessSummary(accessUser: AccessUser) {
  const count = accessUser.roles.filter((role) => role !== 'platform-admin').length
    + accessUser.managedIssueCategoryIds.length
    + accessUser.managedFacilityCategoryIds.length;
  return t('adminCenter.scopedAccessSummary', { count });
}

function selectAssignee(accessUser: AccessUser) {
  user.value = accessUser;
  lookup.value = accessUser.email ?? accessUser.uid;
  error.value = '';
}

async function loadAssignees() {
  const scope = selectedAccessScope.value;
  const requestSequence = ++assigneeRequestSequence;
  if (!scope) {
    assignees.value = [];
    assigneesTruncated.value = false;
    return;
  }
  assigneesLoading.value = true;
  assigneeError.value = '';
  try {
    const result = await listScopeAssignments(scope);
    if (requestSequence !== assigneeRequestSequence) return;
    assignees.value = result.users;
    assigneesTruncated.value = result.truncated;
  } catch (caught) {
    if (requestSequence === assigneeRequestSequence) {
      assigneeError.value = t(caught instanceof Error ? caught.message : 'access.theSearchFailed');
    }
  } finally {
    if (requestSequence === assigneeRequestSequence) assigneesLoading.value = false;
  }
}

watch(scopeKind, () => {
  selectedCategoryId.value = '';
  lookup.value = '';
  error.value = '';
});

watch(selectedAccessScope, () => { void loadAssignees(); }, { immediate: true });

async function findUser() {
  const query = lookup.value.trim();
  if (!query || !scopeReady.value) return;
  loading.value = true;
  error.value = '';
  user.value = null;
  try {
    user.value = await findRoleAssignment(query);
    if (!user.value) error.value = t('access.userNotFoundHelp');
  } catch (caught) {
    error.value = t(caught instanceof Error ? caught.message : 'access.theSearchFailed');
  } finally {
    loading.value = false;
  }
}

async function saveAccess(accessUser: AccessUser, grant: boolean) {
  savingUid.value = accessUser.uid;
  try {
    let roles: RoleCode[] = [...accessUser.roles];
    let issueIds = [...accessUser.managedIssueCategoryIds];
    let facilityIds = [...accessUser.managedFacilityCategoryIds];
    if (scopeKind.value === 'announcement') {
      roles = grant
        ? [...new Set([...roles.filter((role) => role !== 'platform-admin'), 'announcement-manager' as const])]
        : roles.filter((role) => role !== 'announcement-manager');
    } else if (scopeKind.value === 'issue') {
      issueIds = grant ? [...new Set([...issueIds, selectedCategoryId.value])] : issueIds.filter((id) => id !== selectedCategoryId.value);
    } else {
      facilityIds = grant ? [...new Set([...facilityIds, selectedCategoryId.value])] : facilityIds.filter((id) => id !== selectedCategoryId.value);
    }
    const result = await setUserRoles(accessUser.uid, roles, issueIds, facilityIds);
    const updated = { ...accessUser, ...result };
    if (user.value?.uid === accessUser.uid) user.value = updated;
    await loadAssignees();
    show(t('adminCenter.accessSaved'), 'success');
    return true;
  } catch (caught) {
    const message = t(caught instanceof Error ? caught.message : 'access.saveFailed');
    if (user.value?.uid === accessUser.uid) error.value = message;
    else assigneeError.value = message;
    return false;
  } finally {
    savingUid.value = '';
  }
}

async function saveSelectedAccess(grant: boolean) {
  if (!user.value) return;
  error.value = '';
  await saveAccess(user.value, grant);
}

async function revokeAssignee(accessUser: AccessUser) {
  assigneeError.value = '';
  await saveAccess(accessUser, false);
}

onMounted(async () => {
  await refresh();
  await loadAssignees();
});
</script>
