const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
export const READ_REQUEST_TIMEOUT_MS = 5_000;
export const LONG_REQUEST_TIMEOUT_MS = 30_000;

type RequestFailureCode = 'aborted' | 'http' | 'network' | 'timeout' | 'unknown';

export class RequestFailure extends Error {
  readonly code: RequestFailureCode;
  readonly status?: number;

  constructor(message: string, code: RequestFailureCode, status?: number) {
    super(message);
    this.name = 'RequestFailure';
    this.code = code;
    this.status = status;
  }
}

interface RequestOptions {
  label?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function abortedFailure(signal: AbortSignal, label: string) {
  return signal.reason instanceof RequestFailure
    ? signal.reason
    : new RequestFailure(`${label}已取消。`, 'aborted');
}

export async function withRequestTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: RequestOptions = {},
): Promise<T> {
  const label = options.label ?? '請求';
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  let timedOut = false;

  const abortFromParent = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abortFromParent();
  options.signal?.addEventListener('abort', abortFromParent, { once: true });

  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort(new RequestFailure(`${label}逾時，請檢查網路後重試。`, 'timeout'));
  }, timeoutMs);

  const aborted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(
      timedOut
        ? new RequestFailure(`${label}逾時，請檢查網路後重試。`, 'timeout')
        : abortedFailure(controller.signal, label),
    ), { once: true });
  });

  try {
    return await Promise.race([operation(controller.signal), aborted]);
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    if (controller.signal.aborted) throw abortedFailure(controller.signal, label);
    throw new RequestFailure(
      error instanceof Error && error.message ? error.message : `${label}失敗。`,
      'network',
    );
  } finally {
    window.clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', abortFromParent);
  }
}

export async function safeFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: RequestOptions = {},
) {
  return withRequestTimeout(async (signal) => {
    const response = await fetch(input, {
      ...init,
      cache: init.cache ?? 'no-store',
      signal,
    });
    if (!response.ok) {
      throw new RequestFailure(`請求失敗（${response.status}）。`, 'http', response.status);
    }
    return response;
  }, {
    ...options,
    signal: options.signal ?? init.signal ?? undefined,
  });
}

export function isAbortFailure(error: unknown) {
  return error instanceof RequestFailure && error.code === 'aborted';
}

export function formatRequestError(error: unknown, fallback = '網路似乎有問題，請稍後再試。') {
  if (error instanceof RequestFailure) {
    if (error.code === 'aborted') return '';
    if (error.code === 'timeout') return '網路回應時間過長，請重新載入。';
    return error.message || fallback;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
