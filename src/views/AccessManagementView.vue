<template>
  <RoutePageFrame padding="responsive">
    <SurfacePanel as="form" padding="lg" @submit.prevent="findUser">
      <label for="access-user-lookup" class="field-label">{{ t('access.findAUser') }}</label>
      <div class="mt-2 flex gap-2">
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
      <p class="mt-2 text-xs leading-5 text-ink-500">{{ t('access.enterAFullSchoolEmailAddressOrUid') }}</p>
    </SurfacePanel>

    <EmptyStatePanel v-if="error" class="mt-4" title="access.unableToFindUser" :description="error" icon="warning" />

    <SurfacePanel v-if="user" as="article" padding="lg" class="mt-4">
      <div class="flex items-center gap-3 border-b border-ink-100 pb-4 dark:border-ink-800">
        <UserAvatar :photo-url="user.photoUrl" :name="user.name" size="md" />
        <div class="min-w-0">
          <h2 class="truncate text-base font-bold text-ink-900 dark:text-ink-100">{{ user.name }}</h2>
          <p class="mt-0.5 truncate text-xs text-ink-500">{{ user.email || user.uid }}</p>
          <p v-if="user.email" class="mt-0.5 truncate text-xs text-ink-400">{{ user.uid }}</p>
        </div>
      </div>

      <div class="mt-5 space-y-5">
        <div>
          <p class="field-label mb-2">{{ t('access.platformAccess') }}</p>
          <SelectionOptionButton
            label="access.platformAdministrator"
            description="access.platformAdminDescription"
            :selected="isPlatformAdmin"
            :disabled="Boolean(savingUid)"
            @select="togglePlatformAdmin"
          />
        </div>

        <div>
          <p class="field-label mb-2">{{ t('access.proposalCategoryAccess') }}</p>
          <div class="grid gap-2">
            <SelectionOptionButton
              v-for="category in activeIssueCategories"
              :key="category.id"
              :label="t('access.manageCategory', { category: category.label })"
              :description="t('access.reviewAndManageProposalsInCategory', { category: category.label })"
              :selected="isPlatformAdmin || user.managedIssueCategoryIds.includes(category.id)"
              :disabled="Boolean(savingUid) || isPlatformAdmin"
              @select="toggleCategory(category.id)"
            />
          </div>
        </div>

        <div>
          <p class="field-label mb-2">{{ t('access.facilityCategoryAccess') }}</p>
          <div class="grid gap-2">
            <SelectionOptionButton
              v-for="category in activeFacilityCategories"
              :key="category.id"
              :label="t('access.manageCategory', { category: category.label })"
              :description="t('access.handleFacilityReportsInCategory', { category: category.label })"
              :selected="isPlatformAdmin || user.managedFacilityCategoryIds.includes(category.id)"
              :disabled="Boolean(savingUid) || isPlatformAdmin"
              @select="toggleFacilityCategory(category.id)"
            />
          </div>
        </div>

        <div>
          <p class="field-label mb-2">{{ t('access.featureAccess') }}</p>
          <div class="grid gap-2">
            <SelectionOptionButton
              label="access.announcementManagement"
              description="access.publishAndDeleteAnnouncements"
              :selected="isPlatformAdmin || user.roles.includes('announcement-manager')"
              :disabled="Boolean(savingUid) || isPlatformAdmin"
              @select="toggleScopedRole('announcement-manager')"
            />
          </div>
        </div>
      </div>
    </SurfacePanel>
  </RoutePageFrame>
</template>

<script setup lang="ts">
import RoutePageFrame from '@/components/ui/organisms/RoutePageFrame.vue';
import { computed, onMounted, ref } from 'vue';
import SelectionOptionButton from '@/components/ui/molecules/SelectionOptionButton.vue';
import EmptyStatePanel from '@/components/ui/molecules/EmptyStatePanel.vue';
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';
import BusyButtonContent from '@/components/ui/atoms/BusyButtonContent.vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import UserAvatar from '@/components/ui/atoms/UserAvatar.vue';
import { useCategories } from '@/composables/useCategories';
import { listRoleAssignments, setUserRoles, type AccessUser } from '@/services/access';
import type { RoleCode } from '@/services/session-role';
import { useI18n } from '@/i18n';

const lookup = ref('');
const { t } = useI18n();
const { activeFacilityCategories, activeIssueCategories, refresh } = useCategories();
const user = ref<AccessUser | null>(null);
const loading = ref(false);
const error = ref('');
const savingUid = ref('');
const isPlatformAdmin = computed(() => user.value?.roles.includes('platform-admin') === true);

async function findUser() {
  const query = lookup.value.trim();
  if (!query) return;
  loading.value = true;
  error.value = '';
  user.value = null;
  try {
    const matches = await listRoleAssignments(query);
    user.value = matches[0] ?? null;
    if (!user.value) error.value = t('access.userNotFoundHelp');
  } catch (caught) {
    error.value = caught instanceof Error ? t(caught.message) : t('access.theSearchFailed');
  } finally {
    loading.value = false;
  }
}

async function saveAccess(roles: RoleCode[], categories: string[], facilityCategories: string[]) {
  if (!user.value) return;
  savingUid.value = user.value.uid;
  error.value = '';
  try {
    const result = await setUserRoles(user.value.uid, roles, categories, facilityCategories);
    user.value.roles = result.roles;
    user.value.managedIssueCategoryIds = result.managedIssueCategoryIds;
    user.value.managedFacilityCategoryIds = result.managedFacilityCategoryIds;
  } catch (caught) {
    error.value = caught instanceof Error ? t(caught.message) : t('access.saveFailed');
  } finally {
    savingUid.value = '';
  }
}

async function togglePlatformAdmin() {
  if (!user.value) return;
  await saveAccess(isPlatformAdmin.value ? [] : ['platform-admin'], [], []);
}

async function toggleCategory(categoryId: string) {
  if (!user.value || isPlatformAdmin.value) return;
  const categories = user.value.managedIssueCategoryIds.includes(categoryId)
    ? user.value.managedIssueCategoryIds.filter((value) => value !== categoryId)
    : [...user.value.managedIssueCategoryIds, categoryId];
  await saveAccess(user.value.roles.filter((role) => role !== 'proposal-manager'), categories, user.value.managedFacilityCategoryIds);
}

async function toggleFacilityCategory(categoryId: string) {
  if (!user.value || isPlatformAdmin.value) return;
  const categories = user.value.managedFacilityCategoryIds.includes(categoryId)
    ? user.value.managedFacilityCategoryIds.filter((value) => value !== categoryId)
    : [...user.value.managedFacilityCategoryIds, categoryId];
  await saveAccess(user.value.roles.filter((role) => role !== 'general-affairs'), user.value.managedIssueCategoryIds, categories);
}

async function toggleScopedRole(role: Extract<RoleCode, 'announcement-manager' | 'general-affairs'>) {
  if (!user.value || isPlatformAdmin.value) return;
  const roles = user.value.roles.includes(role)
    ? user.value.roles.filter((value) => value !== role)
    : [...user.value.roles.filter((value) => value !== 'proposal-manager'), role];
  await saveAccess(roles, user.value.managedIssueCategoryIds, user.value.managedFacilityCategoryIds);
}

onMounted(() => { void refresh(); });
</script>
