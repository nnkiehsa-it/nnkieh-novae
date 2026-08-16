import type { Env, JsonRecord } from './types';
import { API_ERRORS, type ApiErrorCode } from '../generated/api-errors';

export const MAX_BODY_BYTES = 64 * 1024;

export function allowedOrigins(env: Env) {
  return new Set(env.ALLOWED_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean));
}

export function corsHeaders(request: Request, env: Env) {
  const origin = request.headers.get('origin') ?? '';
  return {
    'access-control-allow-headers': 'authorization, content-type, x-firebase-appcheck, x-turnstile-token',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-origin': allowedOrigins(env).has(origin) ? origin : 'null',
    'access-control-max-age': '86400',
    'vary': 'Origin',
  };
}

export function jsonResponse(request: Request, env: Env, data: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(data, {
    status,
    headers: {
      ...corsHeaders(request, env),
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

export function apiErrorResponse(
  request: Request,
  env: Env,
  requestId: string,
  code: ApiErrorCode,
  retryAfterSeconds?: number,
  headers: HeadersInit = {},
) {
  const retryAfter = retryAfterSeconds && Number.isFinite(retryAfterSeconds)
    ? Math.max(1, Math.ceil(retryAfterSeconds))
    : undefined;
  const error = retryAfter ? { code, retryAfterSeconds: retryAfter } : { code };
  return jsonResponse(
    request,
    env,
    { error, requestId, success: false },
    API_ERRORS[code].status,
    retryAfter ? { ...headers, 'retry-after': String(retryAfter) } : headers,
  );
}

export async function readBody(request: Request) {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new Error('request-too-large');
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength > MAX_BODY_BYTES) throw new Error('request-too-large');
  return body;
}

export function parseJsonRecord(body: Uint8Array): JsonRecord {
  try {
    const value = JSON.parse(new TextDecoder().decode(body)) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
  } catch {
    throw new Error('invalid-json');
  }
}

export function isAllowedBrowserRequest(request: Request, env: Env) {
  const origin = request.headers.get('origin');
  return Boolean(origin && allowedOrigins(env).has(origin));
}
