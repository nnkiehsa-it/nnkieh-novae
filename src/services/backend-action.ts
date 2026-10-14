import { safeFetch, withRequestTimeout, waitForWriteCooldown } from '@/lib/request';
import { getFirebaseIdToken } from '@/lib/auth-token';
import { ACTIONS, type ActionName, type ActionOutput, type ActionRequest } from "@shared/actions.ts";
import { isWriteGroup } from "@shared/contract.ts";
import { auth } from '@/lib/firebase';
import { apiGatewayUrl } from '@/lib/api-gateway';
import { ApiRequestError, type ApiErrorResponse } from '@/lib/api-error';
import { backendSecurityHeaders } from '@/lib/backend-security';
import { setOperationPolicies, getOperationPolicy, operationPolicyRevision } from '@/lib/operation-policies';
import { readNdjson } from '@/lib/ndjson';

/**
 * The settings change a few times a year, so nothing goes looking for them.
 * Every successful response says which revision the Worker answered with, and
 * only a revision this client has not seen costs a request — which is why
 * there is no poll here: one would spend a full Worker invocation a minute per
 * signed-in tab to learn that nothing had changed.
 */
let policyRefresh: Promise<void> | null = null;

function refreshRuntimePolicies() {
  policyRefresh ??= callAction('getRuntimePolicies', {})
    .then(snapshot => { setOperationPolicies(snapshot); })
    .finally(() => { policyRefresh = null; });
  return policyRefresh;
}

/**
 * One line of an answer in flight: the action names the operation it is
 * answering, sends each piece of the answer as it is ready, and says when it
 * is finished — or, if it failed after the first piece had already left, says
 * so on the line where an HTTP status can no longer be used.
 */
type BackendActionLine =
  | { operationId: string; policyRevision: number; type: 'start' }
  | { data: unknown; key?: string; type: 'part' }
  | { type: 'end' }
  | { error: ApiErrorResponse['error']; type: 'error' };

interface StreamedAnswer {
  operationId: string;
  policyRevision: number;
  result: unknown;
}

async function readAnswer(
  body: ReadableStream<Uint8Array>,
  onSegment?: (key: string | undefined, data: unknown) => void,
  assertCurrentSession: () => void = () => {},
): Promise<StreamedAnswer> {
  let start: { operationId: string; policyRevision: number } | null = null;
  let finished = false;
  let whole: unknown;
  let fields: Record<string, unknown> | undefined;
  for await (const line of readNdjson(body)) {
    assertCurrentSession();
    const entry = line as BackendActionLine;
    if (entry.type === 'start') {
      start = { operationId: entry.operationId, policyRevision: entry.policyRevision };
    } else if (entry.type === 'part') {
      if (entry.key === undefined) whole = entry.data;
      else (fields ??= {})[entry.key] = entry.data;
      onSegment?.(entry.key, entry.data);
    } else if (entry.type === 'error') {
      throw new ApiRequestError({ error: entry.error, operationId: start?.operationId });
    } else if (entry.type === 'end') {
      finished = true;
    }
  }
  if (!start || !finished) throw new Error('common.theServiceDidNotReturnAnyData');
  const assembled = fields
    ? { ...(whole && typeof whole === 'object' && !Array.isArray(whole) ? whole as Record<string, unknown> : {}), ...fields }
    : whole;
  return { ...start, result: assembled };
}

export function invokeBackendAction<TRequest = Record<string, unknown>, TResponse = unknown>(
  name: ActionName,
  options: {
    onSegment?: (key: string | undefined, data: unknown) => void;
    operationId?: string;
    signal?: AbortSignal;
    timeoutMs?: number | (() => number);
  } = {},
) {
  return async (initialPayload: TRequest): Promise<TResponse> => {
    const isWrite = isWriteGroup(ACTIONS[name].group);
    const timeoutMs = (typeof options.timeoutMs === 'function' ? options.timeoutMs() : options.timeoutMs)
      ?? getOperationPolicy(isWrite ? 'requestTimeoutMs' : 'readTimeoutMs');
    const operationId = options.operationId || crypto.randomUUID();

    const requestUser = auth?.currentUser;
    const requestUid = requestUser?.uid ?? '';
    const assertCurrentSession = () => {
      if (!requestUser || auth?.currentUser !== requestUser) {
        throw new Error('auth.loginStatusChangedPreviousResponseIgnored');
      }
    };
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

    assertCurrentSession();
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

    try {
      assertCurrentSession();
    } catch (error) {
      await response.body?.cancel().catch(() => undefined);
      throw error;
    }
    if (!response.body) throw new Error('common.theServiceDidNotReturnAnyData');

    const answer = await readAnswer(response.body, options.onSegment, assertCurrentSession);
    assertCurrentSession();

    if (name === 'getSessionBootstrap') {
      setOperationPolicies((answer.result as ActionOutput<'getSessionBootstrap'>).runtimePolicies);
    } else if (name !== 'getRuntimePolicies' && answer.policyRevision !== operationPolicyRevision()) {
      void refreshRuntimePolicies().catch(() => undefined);
    }
    return answer.result as TResponse;
  };
}

type ActionOptions = Parameters<typeof invokeBackendAction>[1];

/** Calls an action with the request and answer its contract describes. */
export function callAction<N extends ActionName>(name: N, payload: ActionRequest<N>, options?: ActionOptions) {
  return invokeBackendAction<ActionRequest<N>, ActionOutput<N>>(name, options)(payload);
}
