import { readonly, ref } from 'vue';

export type ToastKind = 'info' | 'success' | 'error';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const toasts = ref<ToastItem[]>([]);
let nextToastId = 1;

export function useToast() {
  function dismissToast(id: number) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }

  function showToast(message: string, kind: ToastKind = 'info') {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    const id = nextToastId++;
    toasts.value = [
      { id, kind, message: trimmed },
      ...toasts.value.filter((toast) => toast.message !== trimmed),
    ].slice(0, 3);

    window.setTimeout(() => {
      dismissToast(id);
    }, 3500);
  }

  return {
    toasts: readonly(toasts),
    showToast,
    dismissToast,
  };
}
