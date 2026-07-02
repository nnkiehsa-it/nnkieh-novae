import { onBeforeUnmount, ref } from 'vue';

export function useTimedMessage(timeoutMs = 4000) {
  const message = ref('');
  let timer: ReturnType<typeof window.setTimeout> | null = null;

  function showMessage(nextMessage: string) {
    message.value = nextMessage;
    if (timer) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(() => {
      message.value = '';
      timer = null;
    }, timeoutMs);
  }

  onBeforeUnmount(() => {
    if (timer) {
      window.clearTimeout(timer);
    }
  });

  return {
    message,
    showMessage,
  };
}
