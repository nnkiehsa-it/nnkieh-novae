import { errorStatus, publicErrorBody } from "../shared/http.ts";
import type { ApiErrorCode } from "../shared/api-errors.ts";

export interface ApiErrorBody {
  code: ApiErrorCode;
  retryAfterSeconds?: number;
}

export interface ApiSuccessEnvelope<TData> {
  data: TData;
  requestId: string;
  success: true;
}

export interface ApiErrorEnvelope {
  error: ApiErrorBody;
  requestId: string;
  success: false;
}

export function successEnvelope<TData>(data: TData, requestId: string): ApiSuccessEnvelope<TData> {
  return { data, requestId, success: true };
}

export function errorEnvelope(error: unknown, requestId: string): ApiErrorEnvelope {
  return {
    error: publicErrorBody(error),
    requestId,
    success: false,
  };
}

export function successResponse<TData>(data: TData, requestId: string, init: ResponseInit = {}) {
  return Response.json(successEnvelope(data, requestId), init);
}

export function errorResponse(error: unknown, requestId: string, init: ResponseInit = {}) {
  const envelope = errorEnvelope(error, requestId);
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
