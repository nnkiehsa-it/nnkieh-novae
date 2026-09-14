import { safeFetch, withRequestTimeout, waitForWriteCooldown } from '@/lib/request';
import { getFirebaseIdToken } from '@/lib/auth-token';
import { BACKEND_ACTION_POLICIES, type BackendActionName } from '@/services/backend-action-contract';
import { auth } from '@/lib/firebase';
import { apiGatewayUrl } from '@/lib/api-gateway';
import { ApiRequestError, type ApiErrorResponse } from '@/lib/api-error';
import { backendSecurityHeaders } from '@/lib/backend-security';
import { setOperationPolicies, getOperationPolicy, operationPolicyRevision, type PolicySnapshot } from '@/lib/operation-policies';

/**
 * The settings change a few times a year, so nothing goes looking for them.
 * Every successful response says which revision the Worker answered with, and
 * only a revision this client has not seen costs a request — which is why
 * there is no poll here: one would spend a full Worker invocation a minute per
 * signed-in tab to learn that nothing had changed.
 */
let policyRefresh: Promise<void> | null = null;

function refreshRuntimePolicies() {
  policyRefresh ??= invokeBackendAction<Record<string, never>, PolicySnapshot>('getRuntimePolicies')({})
    .then(snapshot => { setOperationPolicies(snapshot); })
    .finally(() => { policyRefresh = null; });
  return policyRefresh;
}

interface BackendActionSuccessEnvelope<TResponse> {
  data: TResponse;
  operationId: string;
  policyRevision: number;
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
      setOperationPolicies((envelope.data as { runtimePolicies: PolicySnapshot }).runtimePolicies);
    } else if (name !== 'getRuntimePolicies' && envelope.policyRevision !== operationPolicyRevision()) {
      void refreshRuntimePolicies().catch(() => undefined);
    }
    return envelope.data;
  };
}
