import { withRequestTimeout } from '@/lib/request';
import { getFirebaseIdToken } from '@/lib/auth-token';
import type { BackendActionName } from '@/services/backend-action-contract';
import { auth } from '@/lib/firebase';
import { apiGatewayUrl } from '@/lib/api-gateway';
import { ApiRequestError, type ApiErrorResponse } from '@/lib/api-error';
import { readSessionStorage, removeSessionStorage, writeSessionStorage } from '@/lib/browser-storage';
import { backendSecurityHeaders } from '@/lib/backend-security';

interface BackendActionSuccessEnvelope<TResponse> {
  data: TResponse;
  requestId: string;
  success: true;
}

interface BackendActionErrorEnvelope extends ApiErrorResponse {
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
  return `novae:pending-action:${name}:${(hash >>> 0).toString(36)}`;
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
  const requestId = readSessionStorage(storageKey) || record.requestId;
  writeSessionStorage(storageKey, requestId);
  return {
    payload: { ...record, requestId } as TRequest,
    storageKey,
  };
}

export function invokeBackendAction<TRequest = Record<string, unknown>, TResponse = unknown>(
  name: BackendActionName,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
) {
  return (initialPayload: TRequest): Promise<TResponse> => {
    const stableOperation = withStableRequestId(name, initialPayload);
    return withRequestTimeout(async (signal) => {
      const requestUid = auth?.currentUser?.uid ?? '';
      const token = await getFirebaseIdToken();
      if (!token || !requestUid || auth?.currentUser?.uid !== requestUid) {
        throw new Error('common.pleaseLogInFirstBeforeProceeding');
      }

      const response = await fetch(apiGatewayUrl('/v1/actions'), {
        method: 'POST',
        body: JSON.stringify({ action: name, payload: stableOperation.payload }),
        headers: {
          ...(await backendSecurityHeaders(token)),
          'Content-Type': 'application/json',
        },
        signal,
      });
      if (auth?.currentUser?.uid !== requestUid) {
        throw new Error('auth.loginStatusChangedPreviousResponseIgnored');
      }
      let envelope: BackendActionEnvelope<TResponse> | null = null;
      try {
        envelope = await response.json() as BackendActionEnvelope<TResponse>;
      } catch {
        // The response status below supplies the useful fallback.
      }
      if (!envelope) {
        throw new Error('common.theServiceDidNotReturnAnyData');
      }
      if (!response.ok || envelope.success !== true) {
        throw envelope.success === false
          ? new ApiRequestError(envelope)
          : new ApiRequestError({ error: { code: 'upstream-invalid-response' } });
      }
      if (stableOperation.storageKey) removeSessionStorage(stableOperation.storageKey);
      return envelope.data;
    },
    { label: name, signal: options.signal, timeoutMs: options.timeoutMs },
  );
  };
}
