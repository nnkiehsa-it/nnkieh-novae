import { errorStatus, publicErrorBody } from "../shared/http.ts";
import type { ApiErrorCode } from "../shared/api-errors.ts";

export interface ApiErrorBody {
  code: ApiErrorCode;
  message?: string;
  failureId?: string;
  retryAfterSeconds?: number;
}

export interface ApiSuccessEnvelope<TData> {
  data: TData;
  operationId: string;
  success: true;
}

export interface ApiErrorEnvelope {
  error: ApiErrorBody;
  operationId: string;
  success: false;
}

function camelCaseKey(key: string) {
  return key.replace(/_([a-z])/gu, (_match, letter: string) => letter.toUpperCase());
}

function timestampKey(key: string) {
  if (key.endsWith("_at_ms")) return camelCaseKey(key.slice(0, -3));
  if (key.endsWith("AtMs")) return key.slice(0, -2);
  return null;
}

export function toApiJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toApiJson);
  if (!value || typeof value !== "object") return value;

  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (timestampKey(key)) continue;
    result[camelCaseKey(key)] = toApiJson(entry);
  }
  for (const [key, entry] of Object.entries(source)) {
    const targetKey = timestampKey(key);
    if (!targetKey) continue;
    if (targetKey in result) continue;
    result[targetKey] = typeof entry === "number" && Number.isFinite(entry)
      ? new Date(entry).toISOString()
      : null;
  }
  return result;
}

export function successEnvelope<TData>(data: TData, operationId: string): ApiSuccessEnvelope<TData> {
  return { data: toApiJson(data) as TData, operationId, success: true };
}

export function errorEnvelope(error: unknown, operationId: string, failureId?: string): ApiErrorEnvelope {
  return {
    error: publicErrorBody(error, failureId),
    operationId,
    success: false,
  };
}

export function successResponse<TData>(data: TData, operationId: string, init: ResponseInit = {}) {
  return Response.json(successEnvelope(data, operationId), init);
}

export function errorResponse(error: unknown, operationId: string, failureId?: string, init: ResponseInit = {}) {
  const envelope = errorEnvelope(error, operationId, failureId);
  const retryAfterSeconds = envelope.error.retryAfterSeconds;
  return Response.json(
    envelope,
    {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        ...(retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : {}),
      },
      status: init.status ?? errorStatus(error),
    },
  );
}
