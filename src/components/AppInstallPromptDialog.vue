<template>
  <DialogShell
    :open="open"
    :persistent="preventDismiss"
    :padded-surface="false"
    labelled-by="app-install-prompt-title"
    described-by="app-install-prompt-description"
    surface-class="dialog-card flex flex-col !overflow-hidden md:max-w-2xl md:max-h-[min(85dvh,780px)]"
    z-index-class="z-[80]"
    @close="emit('close')"
  >
    <div class="min-h-0 flex-1 overflow-y-auto px-5 pt-6 pb-5 md:px-8 md:pt-8 md:pb-6">
      <div class="flex items-start justify-between gap-4 pb-2">
        <div class="flex min-w-0 items-start gap-4">
          <IconTile tone="surface" aria-hidden="true">
            <AppIcon :name="content.icon" :size="6" :stroke-width="2.1" class="text-current" :class="content.iconToneClass" />
          </IconTile>

          <div class="min-w-0 flex-1">
            <h2 id="app-install-prompt-title" class="text-[1.75rem] font-semibold tracking-[0.015em] text-ink-950 dark:text-ink-50 md:text-3xl">
              {{ content.title }}
            </h2>
            <p v-if="content.description" id="app-install-prompt-description" class="mt-2 max-w-2xl text-sm leading-6 text-ink-600 dark:text-ink-300 md:text-base">
              {{ content.description }}
            </p>
          </div>
        </div>
      </div>

      <div class="mt-5">
        <div class="flex flex-wrap items-center gap-2">
          <TagBadge class="border-primary/30 bg-primary-container/70 text-on-primary-container dark:border-primary/40 dark:bg-primary-container/30 dark:text-primary">
            {{ content.badge }}
          </TagBadge>
          <TagBadge v-if="content.secondaryBadge" class="border-ink-200/80 bg-white/80 text-ink-600 dark:border-ink-700/80 dark:bg-ink-900/70 dark:text-ink-300">
            {{ content.secondaryBadge }}
          </TagBadge>
        </div>
      </div>

      <div class="mt-6">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-base font-semibold tracking-[0.015em] text-ink-950 dark:text-ink-50">{{ t('app.install.steps') }}</h3>
          <TagBadge>{{ t('app.install.stepCount', { count: content.steps.length }) }}</TagBadge>
        </div>

        <ol v-if="content.steps.length" class="mt-4 space-y-3">
          <li
            v-for="(step, index) in content.steps"
            :key="`${index}-${step.title}`"
            class="flex gap-3 border-b border-ink-100/80 pb-3 last:border-b-0 last:pb-0 dark:border-ink-800/80"
          >
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-900 text-sm font-bold text-white dark:bg-ink-100 dark:text-ink-900">
              {{ index + 1 }}
            </span>
            <span class="min-w-0">
              <span class="block text-sm font-semibold text-ink-900 dark:text-ink-100">{{ step.title }}</span>
              <span v-if="step.description" class="mt-1 block text-xs leading-5 text-ink-500 dark:text-ink-400">{{ step.description }}</span>
            </span>
          </li>
        </ol>

        <div v-if="content.notes.length || content.actionTitle" class="mt-6 space-y-4">
          <div v-if="content.notes.length">
            <h4 class="text-sm font-semibold text-ink-900 dark:text-ink-100">{{ t('app.install.notes') }}</h4>
            <ul class="mt-3 space-y-2">
              <li
                v-for="note in content.notes"
                :key="note"
                class="flex gap-2 text-sm leading-6 text-ink-600 dark:text-ink-300"
              >
                <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"></span>
                <span>{{ note }}</span>
              </li>
            </ul>
          </div>

          <div v-if="content.actionTitle">
            <p class="text-sm font-semibold text-ink-900 dark:text-ink-100">{{ content.actionTitle }}</p>
            <p class="mt-1 text-xs leading-5 text-ink-500 dark:text-ink-400">{{ content.actionDescription }}</p>
          </div>
        </div>
      </div>
    </div>

    <DialogActionRow
      v-if="!preventDismiss || content.primaryLabel"
      class="border-t border-ink-100 bg-white/95 px-5 pb-6 pt-4 backdrop-blur dark:border-ink-800 dark:bg-ink-950/95 md:px-8 md:pb-8 md:pt-4"
    >
      <AppButton
        v-if="!preventDismiss"
        variant="secondary"
        @click="handleSecondaryAction"
      >
        {{ content.secondaryLabel }}
      </AppButton>
      <AppButton
        v-if="content.primaryLabel"
        variant="primary"
        class="gap-2"
        data-autofocus
        :disabled="installing"
        @click="handlePrimaryAction"
      >
        <AppIcon v-bind="primaryIconProps" class="shrink-0" />
        {{ content.primaryLabel }}
      </AppButton>
    </DialogActionRow>
  </DialogShell>

  <ConfirmDialog
    :danger="false"
    :open="isSkipConfirmOpen"
    title="app.install.areYouSureYouWantToSkipItFirst"
    message="app.install.skipConfirmation"
    cancel-label="app.install.continueToView"
    confirm-label="app.install.confirmSkip"
    @cancel="isSkipConfirmOpen = false"
    @confirm="confirmSkip"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import IconTile from '@/components/ui/atoms/IconTile.vue';
import TagBadge from '@/components/ui/atoms/TagBadge.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import DialogShell from '@/components/ui/organisms/DialogShell.vue';
import DialogActionRow from '@/components/ui/molecules/DialogActionRow.vue';
import type { AppInstallPromptMode } from '@/composables/useAppInstallPrompt';
import type { InAppBrowserName } from '@/lib/in-app-browser';
import type { AppInstallPromptReason, IosBrowserGuide } from '@/lib/pwa-install';
import { useI18n, type TranslationParams } from '@/i18n';

type InstallStep = {
  description?: string;
  title: string;
};

type InstallContent = {
  actionDescription: string;
  actionTitle: string;
  badge: string;
  description: string;
  icon: 'download' | 'share' | 'warning';
  iconToneClass: string;
  notes: string[];
  primaryLabel: string | null;
  secondaryBadge: string;
  secondaryLabel: string;
  steps: InstallStep[];
  title: string;
};

type InstallContentKeys = InstallContent & {
  descriptionParams?: TranslationParams;
};

const props = defineProps<{
  canInstallNatively: boolean;
  iosBrowserGuide: IosBrowserGuide | null;
  open: boolean;
  mode: AppInstallPromptMode;
  browserName: InAppBrowserName | null;
  installing: boolean;
  reason: AppInstallPromptReason;
}>();

const emit = defineEmits<{
  close: [];
  copyUrl: [];
  install: [];
}>();
const { t } = useI18n();

const contentKeys = computed<InstallContentKeys>(() => {
  const isNotificationInstall = props.reason === 'notifications';
  const installDescription = isNotificationInstall
    ? 'app.install.reliableNotificationsHint'
    : 'app.install.homeScreenAppBenefit';

  if (props.mode === 'in-app-browser') {
    return {
      actionDescription: 'app.install.systemBrowserInstallHelp',
      actionTitle: 'app.install.switchTheOpeningMethodFirst',
      badge: isNotificationInstall ? 'app.install.notificationsRequireHomeScreenMode' : 'app.install.itIsRecommendedToSwitchBrowsers',
      description: isNotificationInstall
        ? 'app.install.inAppBrowser.notifications'
        : 'app.install.inAppBrowser.description',
      descriptionParams: { browser: props.browserName ?? 'App' },
      icon: 'warning',
      iconToneClass: 'text-warning',
      notes: ['app.install.notificationsRequireInstalledApp'],
      primaryLabel: null,
      secondaryBadge: props.browserName
        ? t('app.install.inAppBrowser.badge', { browser: props.browserName })
        : '',
      secondaryLabel: 'app.install.maybeLater',
      steps: [
        { title: 'app.install.clickTheMenuButton', description: 'app.install.browserMenuLocationStep' },
        { title: 'app.install.selectOpenWithBrowser', description: 'app.install.openInSystemBrowserStep' },
        { title: 'app.install.followTheStepsToAddItToTheHomeScreen', description: 'app.install.systemBrowserGuidedInstall' },
      ],
      title: isNotificationInstall ? 'app.install.installUsingTheSystemBrowser' : 'app.install.itIsRecommendedToUseTheSystemBrowserInstead',
    };
  }

  if (props.mode === 'ios-open-safari') {
    const browserName = props.iosBrowserGuide === 'Google' ? 'Google App' : 'Chrome';
    return {
      actionDescription: 'app.install.openCurrentUrlInSafari',
      actionTitle: 'app.install.firstMoveTheUrlToSafari',
      badge: 'app.install.needToUseSafariInstead',
      description: isNotificationInstall
        ? 'app.install.safari.notifications'
        : 'app.install.safari.description',
      descriptionParams: { browser: browserName },
      icon: 'share',
      iconToneClass: 'text-secondary',
      notes: ['app.install.safariNotificationLaunchReminder'],
      primaryLabel: props.installing ? 'app.install.copying' : 'app.install.copyUrl',
      secondaryBadge: browserName,
      secondaryLabel: 'app.install.skipItFirst',
      steps: [
        { title: 'app.install.clickCopyUrl', description: 'app.install.copyUrlFirst' },
        { title: 'app.install.changeToSafariToEnable', description: 'app.install.pasteTheUrlAndGoToTheSamePage' },
        { title: 'app.install.longPressOnTheAddressBar', description: 'app.install.safariAddressBarStep' },
        { title: 'app.install.selectShareButton', description: 'app.install.selectShareFromTheActionThatPopsUp' },
        { title: 'app.install.installedAsApp', description: 'app.install.iosAddToHomeScreenStep' },
      ],
      title: 'app.install.pleaseUseSafariToOpenItInstead',
    };
  }

  if (props.mode === 'ios-install') {
    return {
      actionDescription: '',
      actionTitle: 'app.install.followTheSteps',
      badge: isNotificationInstall ? 'app.install.installFirstToEnableNotifications' : 'app.install.safariInstallationProcess',
      description: '',
      icon: 'share',
      iconToneClass: 'text-primary',
      notes: [installDescription, 'app.install.iosMissingActionHelp', 'app.install.reopenFromHomeScreen'],
      primaryLabel: null,
      secondaryBadge: 'Safari',
      secondaryLabel: 'app.install.maybeLater',
      steps: [
        { title: 'app.install.longPressOnTheAddressBar', description: 'app.install.safariLongPressAddressBar' },
        { title: 'app.install.selectShareButton', description: 'app.install.selectShareFromTheActionsThatAppear' },
        { title: 'app.install.installedAsApp', description: 'app.install.iosShareMenuStep' },
        { title: 'app.install.confirmHowTheAppOpens', description: 'app.install.ifYouSeeOpenAsWebAppPleaseKeepItOpen' },
        { title: 'app.install.clickAddToCompleteTheInstallation', description: 'app.install.reopenInstalledApp' },
      ],
      title: isNotificationInstall ? 'app.install.installTheAppToUseNotifications' : 'app.install.installedAsApp',
    };
  }

  return {
    actionDescription: '',
    actionTitle: props.canInstallNatively ? 'app.install.theSystemWillTakeOverTheInstallation' : '',
    badge: isNotificationInstall ? 'app.install.turnOnNotificationsAfterInstallation' : 'app.install.installOnAndroidHomeScreen',
    description: installDescription,
    icon: 'download',
    iconToneClass: 'text-primary',
    notes: props.canInstallNatively
      ? ['app.install.installationPromptAvailableLater']
      : ['app.install.manualInstallFallback'],
    primaryLabel: props.canInstallNatively ? (props.installing ? 'app.install.opening' : 'app.install.installApp') : null,
    secondaryBadge: props.canInstallNatively ? 'app.install.systemInstallationWindow' : 'app.install.browserMenu',
    secondaryLabel: 'app.install.skipItFirst',
    steps: [
      { title: props.canInstallNatively ? 'app.install.clickInstallApp' : 'app.install.openBrowserMenu', description: props.canInstallNatively ? 'app.install.androidNativePrompt' : 'app.install.browserMenuHint' },
      { title: 'app.install.installedAsApp', description: props.canInstallNatively ? 'app.install.systemDialogStep' : 'app.install.selectInstallAppOrAddToHomeScreenToFinish' },
      { title: 'app.install.openThePlatformFromTheHomeScreen', description: isNotificationInstall ? 'app.install.turnItBackOnAndGoBackToNotificationSettings' : 'app.install.afterThatYouCanEnterDirectlyLikeNormalApp' },
    ],
    title: isNotificationInstall ? 'app.install.installTheAppToUseNotifications' : 'app.install.installApp',
  };
});

const content = computed<InstallContent>(() => {
  const keys = contentKeys.value;
  return {
  ...keys,
  actionDescription: t(keys.actionDescription),
  actionTitle: t(keys.actionTitle),
  badge: t(keys.badge),
  description: t(keys.description, keys.descriptionParams),
  notes: keys.notes.map((note) => t(note)),
  primaryLabel: keys.primaryLabel ? t(keys.primaryLabel) : null,
  secondaryBadge: t(keys.secondaryBadge),
  secondaryLabel: t(keys.secondaryLabel),
  steps: keys.steps.map((step) => ({
    description: step.description ? t(step.description) : undefined,
    title: t(step.title),
  })),
  title: t(keys.title),
  };
});

const primaryIconProps = computed(() => {
  if (props.mode === 'ios-open-safari' || props.mode === 'ios-install') return { name: 'share' as const, size: 4 };
  if (props.mode === 'native-install') return { name: 'download' as const, size: 4, strokeWidth: 2.2 };
  return { name: 'close' as const, size: 4, strokeWidth: 2.2 };
});
const isSkipConfirmOpen = ref(false);

const preventDismiss = computed(() => {
  return props.mode === 'in-app-browser' || props.mode === 'ios-open-safari';
});

function handlePrimaryAction() {
  if (props.mode === 'native-install' && props.canInstallNatively) {
    emit('install');
    return;
  }

  if (props.mode === 'ios-install') {
    emit('close');
    return;
  }

  if (props.mode === 'ios-open-safari') {
    emit('copyUrl');
    return;
  }

  emit('close');
}

function handleSecondaryAction() {
  isSkipConfirmOpen.value = true;
}

function confirmSkip() {
  isSkipConfirmOpen.value = false;
  emit('close');
}
</script>
