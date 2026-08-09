<template>
  <AppUpdatePromptDialog
    :open="shouldShowUpdateDialog"
    :busy="Boolean(reloading)"
    @reload="reloadApp({ reason: 'update' })"
  />
  <Teleport to="body">
    <div
      v-if="reloading"
      class="fixed inset-0 z-[90] flex items-center justify-center bg-ink-950/65 text-white backdrop-blur-md"
      role="status"
      aria-live="assertive"
      :aria-label="t('common.updatingApp')"
    >
      <div class="flex flex-col items-center gap-3">
        <LoadingSpinner :size="8" />
        <p class="text-sm font-semibold">{{ t('common.updating') }}</p>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import AppUpdatePromptDialog from '@/components/AppUpdatePromptDialog.vue';
import LoadingSpinner from '@/components/ui/atoms/LoadingSpinner.vue';
import { useAppUpdate } from '@/composables/useAppUpdate';
import { useI18n } from '@/i18n';

const {
  canAutoReloadCurrentVersion,
  reloadApp,
  reloading,
  updateAvailable,
} = useAppUpdate();
const { t } = useI18n();

const shouldShowUpdateDialog = computed(() => (
  updateAvailable.value
  && !reloading.value
  && !canAutoReloadCurrentVersion()
));

watch(
  updateAvailable,
  (hasUpdate) => {
    if (hasUpdate && canAutoReloadCurrentVersion()) {
      void reloadApp({ automatic: true, reason: 'update' });
    }
  },
  { immediate: true },
);
</script>
