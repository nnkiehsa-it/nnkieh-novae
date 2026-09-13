import { safeFetch, withRequestTimeout, waitForWriteCooldown } from '@/lib/request';
import { getFirebaseIdToken } from '@/lib/auth-token';
import { BACKEND_ACTION_POLICIES, type BackendActionName } from '@/services/backend-action-contract';
import { auth } from '@/lib/firebase';
import { apiGatewayUrl } from '@/lib/api-gateway';
import { ApiRequestError, type ApiErrorResponse } from '@/lib/api-error';
import { backendSecurityHeaders } from '@/lib/backend-security';
import { setOperationPolicies, getOperationPolicy } from '@/lib/operation-policies';
import type { OperationPolicies } from '@/generated/operations';

let policyCheck: { uid: string; at: number; pending?: Promise<void> } | null = null;

export async function refreshRuntimePolicies(uid: string) {
  if (policyCheck?.uid === uid && policyCheck.pending) return policyCheck.pending;
  if (policyCheck?.uid === uid && Date.now() - policyCheck.at < 60_000) return;
  const check = { uid, at: 0, pending: undefined as Promise<void> | undefined };
  policyCheck = check;
  check.pending = invokeBackendAction<Record<string, never>, { values: OperationPolicies }>('getRuntimePolicies')({})
    .then(result => { setOperationPolicies(result.values); check.at = Date.now(); })
    .finally(() => { check.pending = undefined; });
  return check.pending;
}

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
  options: { signal?: AbortSignal; timeoutMs?: number | (() => number); operationId?: string } = {},
) {
  return async (initialPayload: TRequest): Promise<TResponse> => {
    const policy = BACKEND_ACTION_POLICIES[name];
    const isWrite = policy.group !== 'read' && policy.group !== 'upload-resolve';
    const timeoutMs = (typeof options.timeoutMs === 'function' ? options.timeoutMs() : options.timeoutMs)
      ?? getOperationPolicy(isWrite ? 'requestTimeoutMs' : 'readTimeoutMs');
    const operationId = options.operationId || crypto.randomUUID();

    const requestUid = auth?.currentUser?.uid ?? '';
    if (requestUid && name !== 'getRuntimePolicies' && name !== 'getSessionBootstrap') await refreshRuntimePolicies(requestUid);
    if (isWrite) {
      await waitForWriteCooldown(`${requestUid}:${name}`,getOperationPolicy('clientWriteCooldownMs'),options.signal);
    }
    const securityHeaders = await withRequestTimeout(async () => {
      const token = await getFirebaseIdToken();
      if (!token || !requestUid || auth?.currentUser?.uid !== requestUid) {
        throw new Error('common.pleaseLogInFirstBeforeProceeding');
      }
      return backendSecurityHeaders(token);
    }, {
      label: name,
      signal: options.signal,
      timeoutMs,
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
      timeoutMs,
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

    if (name === 'getSessionBootstrap') {
      const data = envelope.data as { runtimePolicies: { values: OperationPolicies } };
      setOperationPolicies(data.runtimePolicies.values);
    }
    return envelope.data;
  };
}
