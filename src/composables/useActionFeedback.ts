import { readonly, ref } from 'vue';

export type FeedbackTone = 'info' | 'progress' | 'success' | 'warning' | 'error';

export interface FeedbackAction {
  label: string;
  run: () => void;
}

export interface FeedbackOptions {
  action?: FeedbackAction;
  duration?: number;
  message: string;
  tone?: FeedbackTone;
}

export interface FeedbackItem extends FeedbackOptions {
  id: number;
  tone: FeedbackTone;
}

export interface FeedbackHandle {
  dismiss: () => void;
  fail: (message: string, action?: FeedbackAction) => void;
  succeed: (message: string) => void;
  update: (message: string) => void;
}

interface RunFeedbackCopy<TResult> {
  action?: FeedbackAction;
  error: string | ((error: unknown) => string);
  pending: string;
  success: string | ((result: TResult) => string);
}

const feedback = ref<FeedbackItem | null>(null);
let nextFeedbackId = 1;
let dismissTimer: number | undefined;

const DEFAULT_DURATIONS: Record<Exclude<FeedbackTone, 'progress'>, number> = {
  error: 5_500,
  info: 4_000,
  success: 2_800,
  warning: 5_500,
};

function clearDismissTimer() {
  if (dismissTimer !== undefined) window.clearTimeout(dismissTimer);
  dismissTimer = undefined;
}

function dismiss(id?: number) {
  if (id !== undefined && feedback.value?.id !== id) return;
  clearDismissTimer();
  feedback.value = null;
}

function scheduleDismiss(item: FeedbackItem) {
  clearDismissTimer();
  if (item.tone === 'progress') return;
  const duration = item.duration ?? DEFAULT_DURATIONS[item.tone];
  dismissTimer = window.setTimeout(() => dismiss(item.id), duration);
}

function normalizeOptions(messageOrOptions: string | FeedbackOptions, tone: FeedbackTone): FeedbackOptions {
  return typeof messageOrOptions === 'string'
    ? { message: messageOrOptions, tone }
    : messageOrOptions;
}

export function useActionFeedback() {
  function show(messageOrOptions: string | FeedbackOptions, tone: FeedbackTone = 'info') {
    const options = normalizeOptions(messageOrOptions, tone);
    const message = options.message.trim();
    if (!message) return 0;

    const item: FeedbackItem = {
      ...options,
      id: nextFeedbackId++,
      message,
      tone: options.tone ?? 'info',
    };
    feedback.value = item;
    scheduleDismiss(item);
    return item.id;
  }

  function update(id: number, message: string, tone: FeedbackTone, action?: FeedbackAction) {
    if (!feedback.value || feedback.value.id !== id || !message.trim()) return;
    const item: FeedbackItem = {
      ...feedback.value,
      action,
      message: message.trim(),
      tone,
    };
    feedback.value = item;
    scheduleDismiss(item);
  }

  function start(message: string): FeedbackHandle {
    const id = show(message, 'progress');
    return {
      dismiss: () => dismiss(id),
      fail: (nextMessage, action) => update(id, nextMessage, 'error', action),
      succeed: (nextMessage) => update(id, nextMessage, 'success'),
      update: (nextMessage) => update(id, nextMessage, 'progress'),
    };
  }

  async function run<TResult>(
    operation: () => Promise<TResult>,
    copy: RunFeedbackCopy<TResult>,
  ): Promise<TResult> {
    const handle = start(copy.pending);
    try {
      const result = await operation();
      handle.succeed(typeof copy.success === 'function' ? copy.success(result) : copy.success);
      return result;
    } catch (error) {
      handle.fail(typeof copy.error === 'function' ? copy.error(error) : copy.error, copy.action);
      throw error;
    }
  }

  return {
    dismiss,
    feedback: readonly(feedback),
    run,
    show,
    start,
  };
}
