<template>
  <Teleport to="body">
    <TransitionGroup
      v-if="toasts.length > 0"
      name="toast"
      tag="div"
      class="toast-viewport pointer-events-none fixed left-1/2 z-[70] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col gap-2"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex cursor-default select-none items-center gap-2.5 rounded-full border px-3.5 py-2.5 font-sans text-sm font-semibold shadow-elevated backdrop-blur-md"
        :class="toastClass(toast.kind)"
        role="status"
      >
        <span
          class="material-symbols-outlined shrink-0 text-[18px] leading-none"
          aria-hidden="true"
        >
          {{ toastIcon(toast.kind) }}
        </span>
        <p class="min-w-0 flex-1 truncate leading-5">
          {{ toast.message }}
        </p>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast, type ToastKind } from '@/composables/useToast';

const { toasts } = useToast();

function toastClass(kind: ToastKind) {
  if (kind === 'success') {
    return 'border-primary/25 bg-white/88 text-on-primary-container dark:bg-ink-900/88 dark:text-primary';
  }
  if (kind === 'error') {
    return 'border-error/25 bg-white/88 text-error dark:bg-ink-900/88 dark:text-error';
  }
  return 'border-secondary/25 bg-white/88 text-on-secondary-container dark:bg-ink-900/88 dark:text-secondary';
}

function toastIcon(kind: ToastKind) {
  if (kind === 'success') {
    return 'check_circle';
  }
  if (kind === 'error') {
    return 'error';
  }
  return 'info';
}
</script>
