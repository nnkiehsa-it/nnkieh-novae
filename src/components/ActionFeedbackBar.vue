<template>
  <Teleport to="body">
    <AnimatePresence>
      <m.div
        v-if="feedback"
        :key="feedback.id"
        class="action-feedback-viewport pointer-events-none fixed z-[9999] flex justify-center md:justify-end"
        :initial="{ opacity: 0, y: 20, scale: 0.96 }"
        :animate="{ opacity: 1, y: 0, scale: 1 }"
        :exit="{ opacity: 0, y: 12, scale: 0.98 }"
        :transition="MOTION_SOFT_SPRING"
        aria-live="polite"
        aria-atomic="true"
      >
        <SurfacePanel
          variant="floating"
          class="action-feedback-card pointer-events-auto flex min-h-14 w-full items-center gap-3 bg-surface/96 px-3.5 py-3 text-ink-800 backdrop-blur-xl dark:bg-surface/96 dark:text-ink-100"
          :class="toneClass"
          role="status"
        >
          <span class="action-feedback-icon grid h-8 w-8 shrink-0 place-items-center rounded-full" aria-hidden="true">
            <LoadingSpinner v-if="feedback.tone === 'progress'" :size="4" />
            <AppIcon v-else :name="toneIcon" :size="4" :stroke-width="2" />
          </span>
          <p class="min-w-0 flex-1 text-sm font-semibold leading-5 tracking-[0.01em]">
            {{ t(feedback.message) }}
          </p>
          <AppButton
            v-if="feedback.action"
            variant="toolbar"
            class="shrink-0 px-3 text-current"
            @click="handleAction"
          >
            {{ t(feedback.action.label) }}
          </AppButton>
        </SurfacePanel>
      </m.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { AnimatePresence, m } from 'motion-v';
import AppIcon, { type AppIconName } from '@/components/ui/atoms/AppIcon.vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import LoadingSpinner from '@/components/ui/atoms/LoadingSpinner.vue';
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { useI18n } from '@/i18n';
import { MOTION_SOFT_SPRING } from '@/lib/ui-motion';

const { dismiss, feedback } = useActionFeedback();
const { t } = useI18n();

const toneClass = computed(() => {
  if (!feedback.value) return '';
  return {
    error: 'text-error',
    info: 'text-ink-800 dark:text-ink-100',
    progress: 'text-ink-800 dark:text-ink-100',
    success: 'text-ink-800 dark:text-ink-100',
    warning: 'text-warning',
  }[feedback.value.tone];
});

const toneIcon = computed<AppIconName>(() => {
  if (feedback.value?.tone === 'success') return 'check-circle';
  if (feedback.value?.tone === 'error' || feedback.value?.tone === 'warning') return 'circle-alert';
  return 'info';
});

function handleAction() {
  const action = feedback.value?.action;
  if (!action) return;
  dismiss(feedback.value?.id);
  action.run();
}
</script>

<style scoped>
.action-feedback-icon {
  background: color-mix(in srgb, currentColor 13%, transparent);
}
</style>
