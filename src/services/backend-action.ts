import { safeFetch, withRequestTimeout } from '@/lib/request';
import { getFirebaseIdToken } from '@/lib/auth-token';
import { BACKEND_ACTION_POLICIES, type BackendActionName } from '@/services/backend-action-contract';
import { auth } from '@/lib/firebase';
import { apiGatewayUrl } from '@/lib/api-gateway';
import { ApiRequestError, type ApiErrorResponse } from '@/lib/api-error';
import { backendSecurityHeaders } from '@/lib/backend-security';

interface BackendActionSuccessEnvelope<TResponse> {
  data: TResponse;
  operationId: string;
  success: true;
}

interface BackendActionErrorEnvelope extends ApiErrorResponse {
  operationId: string;
  success: false;
}

type BackendActionEnvelope<TResponse> =
  | BackendActionSuccessEnvelope<TResponse>
  | BackendActionErrorEnvelope;

export function invokeBackendAction<TRequest = Record<string, unknown>, TResponse = unknown>(
  name: BackendActionName,
  options: { signal?: AbortSignal; timeoutMs?: number; operationId?: string } = {},
) {
  return async (initialPayload: TRequest): Promise<TResponse> => {
    const policy = BACKEND_ACTION_POLICIES[name];
    const isWrite = policy.group !== 'read';
    const operationId = options.operationId || crypto.randomUUID();

    const requestUid = auth?.currentUser?.uid ?? '';
    const securityHeaders = await withRequestTimeout(async () => {
      const token = await getFirebaseIdToken();
      if (!token || !requestUid || auth?.currentUser?.uid !== requestUid) {
        throw new Error('common.pleaseLogInFirstBeforeProceeding');
      }
      return backendSecurityHeaders(token);
    }, {
      label: name,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    });

    const response = await safeFetch(apiGatewayUrl('/v1/actions'), {
      method: 'POST',
      body: JSON.stringify({ action: name, payload: initialPayload }),
      headers: {
        ...securityHeaders,
        'Content-Type': 'application/json',
        ...(isWrite ? { 'X-Novae-Operation-Id': operationId } : {}),
      },
    }, {
      label: name,
      retry: { allowUnsafe: isWrite },
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    });

    if (auth?.currentUser?.uid !== requestUid) {
      throw new Error('auth.loginStatusChangedPreviousResponseIgnored');
    }

    let envelope: BackendActionEnvelope<TResponse> | null = null;
    try {
      envelope = await response.json() as BackendActionEnvelope<TResponse>;
    } catch {
      // JSON parse error handled below
    }

    if (!envelope) {
      throw new Error('common.theServiceDidNotReturnAnyData');
    }

    if (envelope.success !== true) {
      throw new ApiRequestError(envelope);
    }

    return envelope.data;
  };
}
