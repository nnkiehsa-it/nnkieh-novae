import { getSupabaseClient } from '@/lib/supabase';
import { withRequestTimeout } from '@/lib/request';
import { auth } from '@/lib/firebase';
import { readSupabaseFunctionError } from '@/services/supabase-function-error';
import type { BackendActionName } from '@/services/backend-action-contract';

interface BackendActionSuccessEnvelope<TResponse> {
  data: TResponse;
  requestId: string;
  success: true;
}

interface BackendActionErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
  };
  requestId?: string;
  success: false;
}

type BackendActionEnvelope<TResponse> =
  | BackendActionSuccessEnvelope<TResponse>
  | BackendActionErrorEnvelope;

function operationStorageKey(name: BackendActionName, payload: Record<string, unknown>) {
  const operationPayload = { ...payload };
  delete operationPayload.requestId;
  const source = `${name}:${JSON.stringify(operationPayload)}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `srp:pending-action:${name}:${(hash >>> 0).toString(36)}`;
}

function withStableRequestId<TRequest>(name: BackendActionName, payload: TRequest) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { payload, storageKey: '' };
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.requestId !== 'string' || !record.requestId) {
    return { payload, storageKey: '' };
  }
  const storageKey = operationStorageKey(name, record);
  const requestId = sessionStorage.getItem(storageKey) || record.requestId;
  sessionStorage.setItem(storageKey, requestId);
  return {
    payload: { ...record, requestId } as TRequest,
    storageKey,
  };
}

function formatEnvelopeError(envelope: BackendActionErrorEnvelope) {
  const message = envelope.error?.message?.trim() || '服務暫時無法處理請求，請稍後再試。';
  const requestId = envelope.requestId?.trim();
  return requestId ? `${message} 錯誤追蹤碼：${requestId}` : message;
}

export function invokeBackendAction<TRequest = Record<string, unknown>, TResponse = unknown>(
  name: BackendActionName,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
) {
  const client = getSupabaseClient();

  return (initialPayload: TRequest): Promise<TResponse> => {
    const stableOperation = withStableRequestId(name, initialPayload);
    return withRequestTimeout(async (signal) => {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        throw new Error('請先登入後再操作。');
      }

      const result = await client.functions.invoke<BackendActionEnvelope<TResponse>>('backendAction', {
        body: { action: name, payload: stableOperation.payload },
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });
      if (result.error) {
        throw new Error(await readSupabaseFunctionError(result));
      }
      if (result.data === null) {
        throw new Error('服務沒有回傳資料。');
      }
      if (result.data.success !== true) {
        throw new Error(formatEnvelopeError(result.data));
      }
      if (stableOperation.storageKey) sessionStorage.removeItem(stableOperation.storageKey);
      return result.data.data;
    },
    { label: name, signal: options.signal, timeoutMs: options.timeoutMs },
  );
  };
}
