<template>
  <Teleport to="body">
    <TransitionGroup
      v-if="toasts.length > 0"
      name="toast"
      tag="div"
      class="toast-viewport pointer-events-none fixed left-1/2 z-[9999] w-[calc(100%-1.5rem)] max-w-[24rem] -translate-x-1/2"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast-stack-item absolute inset-x-0 top-0 flex justify-center"
      >
        <div
          class="toast-card pointer-events-auto relative flex w-fit min-w-[11rem] max-w-full cursor-default select-none items-center gap-2.5 overflow-hidden rounded-xl px-3 py-2.5 font-sans backdrop-blur-xl sm:min-w-[12rem]"
          :class="toastClass(toast.kind)"
          role="status"
        >
          <span class="toast-icon grid h-7 w-7 shrink-0 place-items-center rounded-full" aria-hidden="true">
            <LoadingSpinner v-if="toast.kind === 'loading'" :size="4" />
            <AppIcon v-else :name="toastIcon(toast.kind)" :size="4" />
          </span>
          <p class="min-w-0 max-w-[18rem] flex-1 text-[13px] font-semibold leading-[1.35rem]">
            {{ toast.message }}
          </p>
          <span v-if="toast.kind === 'loading'" class="toast-progress absolute bottom-0 left-0 h-0.5" aria-hidden="true" />
        </div>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import AppIcon, { type AppIconName } from '@/components/ui/AppIcon.vue';
import { useToast, type ToastKind } from '@/composables/useToast';

const { toasts } = useToast();

function toastClass(kind: ToastKind) {
  if (kind === 'success') {
    return 'bg-white/92 text-on-primary-container dark:bg-ink-900/92 dark:text-primary';
  }
  if (kind === 'error') {
    return 'bg-white/92 text-error dark:bg-ink-900/92 dark:text-error';
  }
  if (kind === 'loading') {
    return 'bg-white/95 text-on-primary-container dark:bg-ink-900/95 dark:text-primary';
  }
  return 'bg-white/92 text-on-secondary-container dark:bg-ink-900/92 dark:text-secondary';
}

function toastIcon(kind: ToastKind): AppIconName {
  if (kind === 'success') {
    return 'check-circle';
  }
  if (kind === 'error') {
    return 'circle-alert';
  }
  return 'info';
}
</script>

<style scoped>
.toast-card {
  box-shadow: 0 18px 42px rgb(15 23 42 / 0.18), 0 4px 12px rgb(15 23 42 / 0.1);
}

.toast-stack-item {
  transform-origin: top center;
  transition:
    opacity 0.28s var(--motion-ease),
    transform 0.38s var(--motion-ease-enter);
}

.toast-icon {
  background: color-mix(in srgb, currentColor 11%, transparent);
}

.toast-progress {
  width: 42%;
  background: linear-gradient(90deg, transparent, currentColor 40%, currentColor 60%, transparent);
  animation: toast-progress 1.6s linear infinite;
  transform: translateX(-110%);
  will-change: transform;
}

@keyframes toast-progress {
  to { transform: translateX(350%); }
}

@media (prefers-reduced-motion: reduce) {
  .toast-progress { animation: none; transform: none; }
}
</style>
