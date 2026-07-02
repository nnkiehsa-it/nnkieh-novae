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
        class="pointer-events-auto flex cursor-default select-none items-start gap-3 rounded-xl border px-4 py-3 font-sans text-xs font-bold shadow-elevated transition-all"
        :class="toastClass(toast.kind)"
        role="status"
      >
        <span
          class="material-symbols-outlined mt-0.5 text-[18px] leading-none"
          aria-hidden="true"
        >
          {{ toastIcon(toast.kind) }}
        </span>
        <p class="min-w-0 flex-1">
          <span class="block text-sm font-bold leading-5">{{ toastTitle(toast.kind) }}</span>
          <span class="block font-semibold leading-5">{{ toast.message }}</span>
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
    return 'bg-primary-container text-on-primary-container border-primary/20';
  }
  if (kind === 'error') {
    return 'bg-error-container text-on-error-container border-error/20';
  }
  return 'bg-secondary-container text-on-secondary-container border-outline/20';
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

function toastTitle(kind: ToastKind) {
  if (kind === 'success') {
    return '完成';
  }
  if (kind === 'error') {
    return '發生錯誤';
  }
  return '提示';
}
</script>
