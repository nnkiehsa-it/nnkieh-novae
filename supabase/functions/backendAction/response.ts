import { errorMessage, errorStatus, publicError } from "../_shared/http.ts";

export interface ApiErrorBody {
  code: string;
  message: string;
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

function errorCode(error: unknown) {
  const message = errorMessage(error);
  if (message === "unauthenticated") return "unauthenticated";
  if (message === "permission-denied") return "permission-denied";
  if (message === "not-found") return "not-found";
  if (message === "method-not-allowed") return "method-not-allowed";
  if (message === "missing action" || message.startsWith("Unsupported action:")) return "invalid-action";
  if (message === "unsupported-action") return "invalid-action";
  if (message === "invalid-json") return "invalid-json";
  if (message === "request-too-large") return "request-too-large";
  if (message === "request-in-progress") return "request-in-progress";
  if (message.includes("push-token-limit-reached")) return "push-token-limit-reached";
  if (message.includes("達到上限") || message.includes("太頻繁") || message.includes("上傳額度已用完")) {
    return "rate-limited";
  }
  if (message.endsWith("-required")) return "validation-required";
  if (message.endsWith("-too-long")) return "validation-too-long";
  if (message.endsWith(" is not configured.")) return "service-not-configured";
  if (message === "rate-limit-provider-unavailable") return "rate-limit-provider-unavailable";
  return "internal-error";
}

function envelopeHeaders(init: ResponseInit = {}) {
  return {
    ...init,
    headers: {
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Origin": "*",
      ...(init.headers ?? {}),
    },
  };
}

export function successEnvelope<TData>(data: TData, requestId: string): ApiSuccessEnvelope<TData> {
  return { data, requestId, success: true };
}

export function errorEnvelope(error: unknown, requestId: string): ApiErrorEnvelope {
  return {
    error: {
      code: errorCode(error),
      message: publicError(error),
    },
    requestId,
    success: false,
  };
}

export function successResponse<TData>(data: TData, requestId: string, init: ResponseInit = {}) {
  return Response.json(successEnvelope(data, requestId), envelopeHeaders(init));
}

export function errorResponse(error: unknown, requestId: string, init: ResponseInit = {}) {
  return Response.json(
    errorEnvelope(error, requestId),
    envelopeHeaders({
      ...init,
      status: init.status ?? errorStatus(error),
    }),
  );
}
