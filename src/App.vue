<template>
  <MotionConfig reduced-motion="user" :transition="MOTION_SMOOTH_TWEEN">
    <LazyMotion strict :features="loadMotionFeatures">
      <AppStartupScreen
        v-if="startupGateOpen"
        :aria-label="startupAriaLabel"
        :message="startupMessage"
        :stalled="startupGateStalled"
        @retry="reloadApp({ reason: 'restart' })"
      />
      <AppShell v-else>
        <div class="route-stage relative h-full min-h-0 min-w-0 w-full max-w-full flex-1">
          <RouterView v-slot="{ Component, route: viewRoute }">
            <AnimatePresence mode="popLayout" :initial="false">
              <m.div
                :key="String(viewRoute.name ?? viewRoute.path)"
                class="route-content-frame flex h-full min-h-0 min-w-0 w-full max-w-full flex-1 flex-col"
                :initial="routeMotionInitial"
                :animate="{ opacity: 1, x: 0, scale: 1 }"
                :exit="routeMotionExit"
                :transition="MOTION_ROUTE_TRANSITION"
              >
                <Suspense>
                  <component :is="Component" />
                  <template #fallback>
                    <div class="flex min-h-[40dvh] items-center justify-center" :aria-label="t('common.switchingPages')" aria-busy="true">
                      <LoadingSpinner :size="8" />
                    </div>
                  </template>
                </Suspense>
              </m.div>
            </AnimatePresence>
          </RouterView>
        </div>
        <ActionFeedbackBar />
        <PushPermissionPromptDialog
          :open="isPushPromptOpen"
          :busy="pushPromptBusy"
          :mode="pushPromptMode"
          @dismiss="dismissPushPrompt"
          @enable="enablePushFromPrompt"
        />
        <AppInstallPromptDialog
          v-if="installPromptMode"
          :can-install-natively="canInstallPromptNatively"
          :open="isInstallPromptOpen"
          :mode="installPromptMode"
          :browser-name="installPromptBrowserName"
          :ios-browser-guide="installPromptIosBrowserGuide"
          :installing="isInstallPrompting"
          :reason="installPromptReason"
          @close="dismissInstallPrompt"
          @copy-url="copyInstallUrl"
          @install="promptInstall"
        />
      </AppShell>
      <AppUpdatePromptDialog
        :open="shouldShowUpdateDialog"
        :busy="Boolean(reloading)"
        @reload="reloadApp({ reason: 'update' })"
      />
      <Teleport to="body">
        <AnimatePresence>
          <m.div
            v-if="reloading"
            class="fixed inset-0 z-[90] flex items-center justify-center bg-ink-950/65 text-white backdrop-blur-md"
            :initial="{ opacity: 0 }"
            :animate="{ opacity: 1 }"
            :exit="{ opacity: 0 }"
            :transition="MOTION_SMOOTH_TWEEN"
            role="status"
            aria-live="assertive"
            :aria-label="reloadingAriaLabel"
          >
            <m.div
              class="flex flex-col items-center gap-3"
              :initial="{ opacity: 0, scale: 0.94, y: 10 }"
              :animate="{ opacity: 1, scale: 1, y: 0 }"
              :exit="{ opacity: 0, scale: 0.97, y: -6 }"
              :transition="MOTION_SOFT_SPRING"
            >
              <LoadingSpinner :size="8" />
              <p class="text-sm font-semibold">{{ reloadingText }}</p>
            </m.div>
          </m.div>
        </AnimatePresence>
      </Teleport>
    </LazyMotion>
  </MotionConfig>
</template>

<script setup lang="ts">
import { AnimatePresence, LazyMotion, m, MotionConfig } from 'motion-v';
import { RouterView, useRoute, useRouter } from 'vue-router';
import AppShell from '@/components/AppShell.vue';
import AppStartupScreen from '@/components/AppStartupScreen.vue';
import AppInstallPromptDialog from '@/components/AppInstallPromptDialog.vue';
import AppUpdatePromptDialog from '@/components/AppUpdatePromptDialog.vue';
import PushPermissionPromptDialog from '@/components/PushPermissionPromptDialog.vue';
import ActionFeedbackBar from '@/components/ActionFeedbackBar.vue';
import LoadingSpinner from '@/components/ui/atoms/LoadingSpinner.vue';
import { useAppInstallPrompt } from '@/composables/useAppInstallPrompt';
import { useAppStartupGate } from '@/composables/useAppStartupGate';
import { useAppUpdate } from '@/composables/useAppUpdate';
import { usePushPermissionPrompt } from '@/composables/usePushPermissionPrompt';
import { useSession } from '@/composables/useSession';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { ensureCategoryCatalog } from '@/composables/useCategories';
import { getDefaultAuthenticatedRoute } from '@/router/default-route';
import { preloadPrimaryRouteComponents } from '@/router/route-components';
import { getRouteNavigationDepth } from '@/router/navigation-hierarchy';
import { useI18n } from '@/i18n';
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from '@/lib/browser-storage';
import {
  MOTION_ROUTE_TRANSITION,
  MOTION_SMOOTH_TWEEN,
  MOTION_SOFT_SPRING,
} from '@/lib/ui-motion';

const loadMotionFeatures = () => import('@/lib/motion-features').then((module) => module.default);

const APP_RELEASE_MARKER = '2026-06-27-1516';
const LAST_APP_VERSION_STORAGE_KEY = 'novae:last-app-version';
const PENDING_UPDATE_VERSION_STORAGE_KEY = 'novae:pending-update-version';

if (typeof document !== 'undefined') {
  document.documentElement.dataset.appRelease = APP_RELEASE_MARKER;
}

const { canAutoReloadCurrentVersion, reloadApp, reloading, updateAvailable } = useAppUpdate();
const { open: startupGateOpen, stalled: startupGateStalled } = useAppStartupGate();
const route = useRoute();
const router = useRouter();
const { appReady, isAdmin, roleLoading, user } = useSession();
const { t } = useI18n();
const routeTransitionName = ref('route-fade');
const routeMotionInitial = computed(() => ({
  opacity: 0,
  scale: routeTransitionName.value === 'route-fade' ? 0.995 : 1,
  x: routeTransitionName.value === 'route-forward'
    ? 22
    : routeTransitionName.value === 'route-back' ? -22 : 0,
}));
const routeMotionExit = computed(() => ({
  opacity: 0,
  scale: routeTransitionName.value === 'route-fade' ? 0.995 : 1,
  x: routeTransitionName.value === 'route-forward'
    ? -14
    : routeTransitionName.value === 'route-back' ? 14 : 0,
}));
let previousNavigationDepth = getRouteNavigationDepth(route);

watch(() => route.fullPath, () => {
  const nextNavigationDepth = getRouteNavigationDepth(route);
  routeTransitionName.value = nextNavigationDepth > previousNavigationDepth
    ? 'route-forward'
    : nextNavigationDepth < previousNavigationDepth ? 'route-back' : 'route-fade';
  previousNavigationDepth = nextNavigationDepth;
});
let routePreloadIdleId: number | null = null;
let routePreloadTimer = 0;
const idleWindow = window as unknown as {
  cancelIdleCallback?: (handle: number) => void;
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
};

function cancelRoutePreload() {
  if (routePreloadIdleId !== null) {
    idleWindow.cancelIdleCallback?.(routePreloadIdleId);
  }
  window.clearTimeout(routePreloadTimer);
  routePreloadIdleId = null;
  routePreloadTimer = 0;
}

function scheduleRoutePreload() {
  cancelRoutePreload();
  if (startupGateOpen.value || !user.value?.uid || updateAvailable.value) return;

  const preload = () => {
    routePreloadIdleId = null;
    routePreloadTimer = 0;
    if (updateAvailable.value) return;
    void preloadPrimaryRouteComponents(isAdmin.value);
  };
  if (idleWindow.requestIdleCallback) {
    routePreloadIdleId = idleWindow.requestIdleCallback(preload, { timeout: 1_200 });
    return;
  }
  routePreloadTimer = window.setTimeout(preload, 250);
}

const reloadingText = computed(() => {
  return t(reloading.value === 'restart' ? 'common.restarting' : 'common.updating');
});

const reloadingAriaLabel = computed(() => {
  return t(reloading.value === 'restart' ? 'common.restarting' : 'common.updating');
});

const startupAriaLabel = computed(() => {
  if (reloading.value === 'restart') return t('common.restartingApp');
  if (reloading.value === 'update') return t('common.updatingApp');
  return t('common.startingApp');
});

const startupMessage = computed(() => {
  if (reloading.value === 'restart') return t('common.restarting');
  if (reloading.value === 'update') return t('common.updating');
  return '';
});

const shouldShowUpdateDialog = computed(() => {
  if (!updateAvailable.value) return false;
  if (startupGateOpen.value) return false;
  if (reloading.value) return false;
  if (canAutoReloadCurrentVersion()) return false;
  return true;
});

const {
  busy: pushPromptBusy,
  dismiss: dismissPushPrompt,
  enable: enablePushFromPrompt,
  mode: pushPromptMode,
  open: isPushPromptOpen,
} = usePushPermissionPrompt();

const {
  browserName: installPromptBrowserName,
  canInstallNatively: canInstallPromptNatively,
  copyInstallUrl,
  dismiss: dismissInstallPrompt,
  iosBrowserGuide: installPromptIosBrowserGuide,
  isPrompting: isInstallPrompting,
  mode: installPromptMode,
  open: isInstallPromptOpen,
  promptInstall,
  reason: installPromptReason,
} = useAppInstallPrompt();

function normalizeRedirectPath(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const path = typeof rawValue === 'string' ? rawValue.trim() : '';

  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/login')) {
    return '';
  }

  return path;
}

watch(
  updateAvailable,
  (hasUpdate) => {
    if (hasUpdate && canAutoReloadCurrentVersion()) {
      void reloadApp({ automatic: true, reason: 'update' });
    }
  },
  { immediate: true },
);

watch(
  [appReady, roleLoading, () => user.value?.uid ?? '', () => route.fullPath],
  ([ready, rolesLoading, uid]) => {
    if (!ready) return;

    // Stay on the public login view until role/bootstrap settles so the default
    // authenticated destination uses a seeded category catalog (not my-proposals).
    if (route.meta.publicOnly && uid) {
      if (rolesLoading) return;
      void (async () => {
        try {
          await ensureCategoryCatalog();
        } catch {
          // Prefer leaving login with feature defaults over remaining stuck.
        }
        if (!route.meta.publicOnly || !user.value?.uid) return;
        await router.replace(normalizeRedirectPath(route.query.redirect) || getDefaultAuthenticatedRoute());
      })();
      return;
    }

    if (route.meta.requiresAuth && !uid) {
      void router.replace({
        name: 'login',
        query: { redirect: route.fullPath },
      });
    }
  },
  { immediate: true },
);

const { show } = useActionFeedback();

watch(
  startupGateOpen,
  (open) => {
    if (!open) {
      const lastVersion = readLocalStorage(LAST_APP_VERSION_STORAGE_KEY);
      const pendingUpdateVersion = readLocalStorage(PENDING_UPDATE_VERSION_STORAGE_KEY);
      const isNewVersion = Boolean(lastVersion && lastVersion !== __APP_VERSION__);
      const completedPendingUpdate = Boolean(
        pendingUpdateVersion
        && pendingUpdateVersion === __APP_VERSION__
        && isNewVersion,
      );

      if (completedPendingUpdate || (isNewVersion && !pendingUpdateVersion)) {
        if (!installPromptMode.value) {
          show(t('common.theVersionHasBeenUpdated'), 'success');
        }
      }
      if (completedPendingUpdate) {
        removeLocalStorage(PENDING_UPDATE_VERSION_STORAGE_KEY);
      }
      writeLocalStorage(LAST_APP_VERSION_STORAGE_KEY, __APP_VERSION__);
    }
  },
  { immediate: true }
);

watch(
  [startupGateOpen, () => user.value?.uid ?? '', isAdmin, updateAvailable],
  scheduleRoutePreload,
  { immediate: true },
);

onBeforeUnmount(cancelRoutePreload);
</script>
