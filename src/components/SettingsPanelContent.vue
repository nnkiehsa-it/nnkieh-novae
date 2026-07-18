<template>
  <div
    class="flex min-h-0 min-w-0 w-full max-w-full flex-col"
    :class="[contentClass, flat ? 'settings-panel--flat overflow-visible' : 'overflow-hidden']"
  >
    <div
      v-if="!flat"
      class="flex items-start justify-between gap-3 border-b border-ink-100 px-4 py-3 dark:border-ink-700"
    >
      <div>
        <p class="text-base font-semibold tracking-[0.015em] text-ink-950 dark:text-ink-50">{{ t('settings.mine') }}</p>
        <p class="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{{ t('notification.accountNotificationsAndAppSettings') }}</p>
      </div>
      <AppButton
        v-if="showClose"
        variant="toolbar"
        class="-mr-1 h-9 w-9 shrink-0 rounded-full p-0"
        :aria-label="t('settings.closeSettings')"
        data-autofocus
        @click="emit('close')"
      >
        <AppIcon name="close" :size="4" />
      </AppButton>
    </div>

    <div
      class="settings-scroll min-h-0 min-w-0 w-full max-w-full"
      :class="flat
        ? 'settings-scroll--flat overflow-visible'
        : 'overflow-x-hidden overflow-y-auto'"
    >
      <SurfacePanel as="section" variant="list" :aria-label="t('settings.accountInformation')" class="settings-group py-4">
        <p v-if="SCHOOL_NAME" class="mb-3 text-xs font-semibold text-ink-500 dark:text-ink-400">
          {{ SCHOOL_NAME }}
        </p>
        <div class="flex min-w-0 max-w-full items-center gap-3">
          <UserAvatar :photo-url="displayPhotoUrl" :name="displayName || 'U'" size="md" :alt-text="t('settings.userAvatar')" class="h-10 w-10 shrink-0" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-ink-950 dark:text-ink-50">
              {{ displayName || t('settings.nameNotSet') }}
            </p>
            <p class="truncate text-xs leading-5 text-ink-500 dark:text-ink-400">
              {{ email }}
            </p>
            <div class="settings-account__uid-row flex min-w-0 items-center gap-1">
              <p class="truncate text-[11px] leading-5 text-ink-400 dark:text-ink-500">{{ t('account.uidLabel') }}{{ uid }}</p>
              <AppButton
                variant="toolbar"
                class="settings-account__uid-copy shrink-0 rounded-full p-0"
                :title="t('settings.copyUid')"
                :aria-label="t('settings.copyUid')"
                @click="copyUid"
              >
                <AppIcon name="copy" :size="3" :stroke-width="2" />
              </AppButton>
            </div>
          </div>
          <AppButton
            variant="secondary"
            class="h-8 min-h-8 shrink-0 gap-1.5 px-2.5 py-1 text-xs font-semibold"
            @click="emit('switchAccount')"
          >
            <AppIcon name="switch-horizontal" :size="3" :stroke-width="2" />
            {{ t('settings.switchAccount') }}
          </AppButton>
        </div>
      </SurfacePanel>

      <SurfacePanel as="section" variant="list" :aria-label="t('dashboard.pushNotification')">
        <ListSurfaceRow
          class="settings-row"
          interactive
          :class="(pushLoading || !pushActionLabel) ? 'opacity-60 cursor-not-allowed' : ''"
          :disabled="pushLoading || !pushActionLabel"
          @click="emit('togglePush')"
        >
          <span class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-ink-950 dark:text-ink-50">{{ t('dashboard.pushNotification') }}</p>
            <p class="mt-1 text-xs leading-5 text-ink-500 dark:text-ink-400">{{ pushStatusDescription }}</p>
            <InlineMessage v-if="pushError" class="mt-1">{{ pushError }}</InlineMessage>
          </span>
          <SwitchIndicator
            v-if="pushActionLabel"
            :checked="pushEnabled"
            :disabled="pushLoading"
            :label="t('dashboard.pushNotification')"
          />
        </ListSurfaceRow>
      </SurfacePanel>

      <LabeledListSection :label="t('notification.notificationTypes')">
        <ListSurfaceRow
          v-for="option in personalNotificationOptions"
          :key="option.key"
          class="settings-row"
          interactive
          :disabled="pushLoading"
          @click="emit('setPreference', option.key, !personalPreferences[option.key])"
        >
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-semibold text-ink-900 dark:text-ink-100">{{ option.label }}</span>
            <span class="mt-0.5 block text-xs leading-5 text-ink-500 dark:text-ink-400">{{ option.description }}</span>
          </span>
          <SwitchIndicator
            :checked="personalPreferences[option.key]"
            :disabled="pushLoading"
            :label="option.label"
          />
        </ListSurfaceRow>
      </LabeledListSection>

      <LabeledListSection :label="t('settings.features')">
        <IconListRow
          :as="RouterLink"
          to="/issues/my-proposals"
          icon="user"
          :label="t('issue.myProposal')"
          :description="t('issue.yourProposalsAndLatestProgress')"
          @click="emit('close')"
        />
        <IconListRow
          v-if="isAdmin"
          :as="RouterLink"
          to="/dashboard"
          icon="chart"
          :label="t('dashboard.statistics')"
          :description="t('settings.viewPlatformUsageAndOperations')"
          @click="emit('close')"
        />
        <IconListRow
          v-if="canManageRoles"
          :as="RouterLink"
          to="/admin/access"
          icon="shield-check"
          :label="t('access.roleManagement')"
          :description="t('access.manageMemberRolesAndPermissions')"
          @click="emit('close')"
        />
        <IconListRow
          icon="restart"
          :label="t('settings.restartApp')"
          :description="t('settings.reloadTheAppAndItsConnections')"
          @click="emit('restartApp')"
        />
      </LabeledListSection>

      <LabeledListSection :label="t('settings.language')">
        <DropdownMenu
          class="!block w-full"
          :fallback-height="languageOptions.length * 48 + 48"
          panel-class="max-w-[calc(100vw-2rem)]"
          :width="240"
        >
          <template #trigger="{ open, toggle }">
            <ListSurfaceRow
              class="settings-row"
              interactive
              aria-haspopup="listbox"
              :aria-expanded="open"
              @click="toggle"
            >
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-semibold text-ink-900 dark:text-ink-100">
                  {{ t(currentLanguage.label) }}
                </span>
                <span class="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">
                  {{ t('settings.changeTheInterfaceLanguage') }}
                </span>
              </span>
              <AppIcon
                name="chevron-down"
                :size="4"
                class="shrink-0 text-ink-400 transition-transform"
                :class="{ 'rotate-180': open }"
              />
            </ListSurfaceRow>
          </template>

          <template #default="{ close }">
            <div class="dropdown-label mb-1">{{ t('settings.language') }}</div>
            <div role="listbox" :aria-label="t('settings.language')" class="space-y-0.5">
              <button
                v-for="option in languageOptions"
                :key="option.value"
                type="button"
                role="option"
                class="dropdown-item justify-between"
                :class="{ 'button-toolbar--active': locale === option.value }"
                :aria-selected="locale === option.value"
                @click="selectLanguage(option.value, close)"
              >
                <span>{{ t(option.label) }}</span>
                <SelectionMark :selected="locale === option.value" />
              </button>
            </div>
          </template>
        </DropdownMenu>
      </LabeledListSection>

      <LabeledListSection :label="t('settings.moreResources')">
        <IconListRow
          as="a"
          :href="PROJECT_CHANGELOG_URL"
          target="_blank"
          rel="noreferrer"
          icon="changelog"
          :label="t('settings.changelog')"
          :description="t('settings.seeTheLatestFeaturesAndFixes')"
          @click="emit('close')"
        />
        <IconListRow
          as="a"
          :href="PROJECT_WEBSITE_URL"
          target="_blank"
          rel="noreferrer"
          icon="link"
          :label="t('settings.officialWebsite')"
          :description="t('settings.openTheNovaeWebsite')"
          @click="emit('close')"
        />
        <IconListRow
          as="a"
          :href="PROJECT_DOCS_URL"
          target="_blank"
          rel="noreferrer"
          icon="changelog"
          :label="t('settings.documentation')"
          :description="t('settings.readArchitectureAndUsageDocumentation')"
          @click="emit('close')"
        />
        <IconListRow
          as="a"
          :href="PROJECT_GITHUB_URL"
          target="_blank"
          rel="noreferrer"
          icon="code"
          :label="t('settings.github')"
          :description="t('issue.viewSourceCodeAndReportIssues')"
          @click="emit('close')"
        />
      </LabeledListSection>

      <AppButton
        variant="danger"
        block
        @click="logoutDialogOpen = true"
      >
        {{ t('auth.signOutLabel') }}
      </AppButton>
    </div>
  </div>

  <ConfirmDialog
    :open="logoutDialogOpen"
    :title="t('auth.signOut')"
    :message="t('auth.signInAgainNotice')"
    :confirm-label="t('auth.signOutLabel')"
    @cancel="logoutDialogOpen = false"
    @confirm="confirmLogout"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import SwitchIndicator from '@/components/ui/atoms/SwitchIndicator.vue';
import InlineMessage from '@/components/ui/atoms/InlineMessage.vue';
import IconListRow from '@/components/ui/molecules/IconListRow.vue';
import LabeledListSection from '@/components/ui/molecules/LabeledListSection.vue';
import ListSurfaceRow from '@/components/ui/molecules/ListSurfaceRow.vue';
import DropdownMenu from '@/components/ui/molecules/DropdownMenu.vue';
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';
import UserAvatar from '@/components/ui/atoms/UserAvatar.vue';
import SelectionMark from '@/components/ui/atoms/SelectionMark.vue';
import {
  PROJECT_CHANGELOG_URL,
  PROJECT_DOCS_URL,
  PROJECT_GITHUB_URL,
  PROJECT_WEBSITE_URL,
  SCHOOL_NAME,
} from '@/constants/app';
import type { PersonalPushPreferenceKey, PersonalPushPreferences } from '@/services/notifications';
import { copyText } from '@/composables/useShareUrl';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { useI18n, type AppLocale } from '@/i18n';

const props = withDefaults(defineProps<{
  contentClass?: string;
  displayName: string;
  displayPhotoUrl: string | null;
  email: string;
  uid: string;
  isAdmin: boolean;
  canManageRoles: boolean;
  personalNotificationOptions: Array<{
    description: string;
    key: PersonalPushPreferenceKey;
    label: string;
  }>;
  personalPreferences: PersonalPushPreferences;
  pushActionLabel: string;
  pushEnabled: boolean;
  pushError: string;
  pushLoading: boolean;
  pushStatusDescription: string;
  showClose?: boolean;
  flat?: boolean;
}>(), {
  contentClass: '',
  showClose: false,
  flat: false,
});

const emit = defineEmits<{
  close: [];
  logout: [];
  restartApp: [];
  setPreference: [key: PersonalPushPreferenceKey, value: boolean];
  switchAccount: [];
  togglePush: [];
}>();

const logoutDialogOpen = ref(false);
const { show } = useActionFeedback();
const { locale, setLocale, t } = useI18n();
const languageOptions: Array<{ label: string; value: AppLocale }> = [
  { label: 'settings.traditionalChinese', value: 'zh-TW' },
  { label: 'settings.english', value: 'en' },
];
const currentLanguage = computed(
  () => languageOptions.find((option) => option.value === locale.value) ?? languageOptions[0],
);

function selectLanguage(value: AppLocale, close: () => void) {
  setLocale(value);
  close();
}

async function copyUid() {
  try {
    await copyText(props.uid);
    show(t('settings.uidCopied'), 'success');
  } catch {
    show(t('settings.unableToCopyUidPleaseTryAgainLater'), 'error');
  }
}

function confirmLogout() {
  logoutDialogOpen.value = false;
  emit('logout');
}
</script>
