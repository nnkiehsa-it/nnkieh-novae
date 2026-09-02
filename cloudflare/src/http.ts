import type { Env, JsonRecord } from './types';
import { API_ERRORS, type ApiErrorCode } from '../generated/api-errors';

export const MAX_BODY_BYTES = 64 * 1024;

export function allowedOrigins(env: Env) {
  return new Set(env.ALLOWED_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean));
}

export function corsHeaders(request: Request, env: Env) {
  const origin = request.headers.get('origin') ?? '';
  return {
    'access-control-allow-headers': 'authorization, content-type, x-firebase-appcheck, x-turnstile-token, x-novae-operation-id',
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

export interface ApiErrorOptions {
  failureId?: string;
  message?: string;
  retryAfterSeconds?: number;
}

export function apiErrorResponse(
  request: Request,
  env: Env,
  operationId: string,
  code: ApiErrorCode,
  options: ApiErrorOptions | number = {},
  headers: HeadersInit = {},
) {
  const normalizedOptions: ApiErrorOptions =
    typeof options === "number" ? { retryAfterSeconds: options } : options;
  const retryAfter = normalizedOptions.retryAfterSeconds && Number.isFinite(normalizedOptions.retryAfterSeconds)
    ? Math.max(1, Math.ceil(normalizedOptions.retryAfterSeconds))
    : undefined;
  const error: { code: ApiErrorCode; message?: string; failureId?: string; retryAfterSeconds?: number } = { code };
  if (normalizedOptions.failureId) error.failureId = normalizedOptions.failureId;
  if (normalizedOptions.message) error.message = normalizedOptions.message;
  if (retryAfter) error.retryAfterSeconds = retryAfter;

  return jsonResponse(
    request,
    env,
    { error, operationId, success: false },
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
