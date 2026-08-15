import { API_ERRORS, isApiErrorCode, type ApiErrorCode } from "./api-errors.ts";

export const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};
const MAX_JSON_BODY_BYTES = 64 * 1024;
export const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;

export function handleCorsPreflight(request: Request) {
  return request.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders }) : null;
}

export function requireMethod(request: Request, method: string) {
  if (request.method === method) return null;
  return jsonResponse(
    { error: { code: "method-not-allowed" }, ok: false },
    {
      headers: { Allow: method },
      status: 405,
    },
  );
}

export function jsonResponse(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });
}

export function textResponse(body: string, init: ResponseInit = {}) {
  return new Response(body, {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const code = asString(record.code);
    const message = asString(record.message);
    const details = asString(record.details);
    const hint = asString(record.hint);
    const parts = [
      code,
      message,
      details ? `details: ${details}` : "",
      hint ? `hint: ${hint}` : "",
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(" | ");

    try {
      return JSON.stringify(record);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

export function errorStatus(error: unknown) {
  return API_ERRORS[publicErrorCode(error)].status;
}

export async function readRequestText(request: Request, maxBytes: number) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("request-too-large");
  }

  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("request-too-large");
        throw new Error("request-too-large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export async function readJsonRecord(request: Request) {
  const body = await readRequestText(request, MAX_JSON_BODY_BYTES);
  try {
    return asRecord(JSON.parse(body) as unknown);
  } catch {
    throw new Error("invalid-json");
  }
}

function normalizePublicErrorToken(token: string): ApiErrorCode | null {
  if (isApiErrorCode(token)) return token;
  const aliases: Record<string, ApiErrorCode> = {
    "missing-result": "validation-required",
    "unsupported-upload-target": "validation-invalid",
    "invalid-parent-comment": "validation-invalid",
    "facility-author-fixed": "support-not-available",
    "facility-closed": "support-not-available",
    "42501": "permission-denied",
    "PGRST116": "not-found",
  };
  if (aliases[token]) return aliases[token];
  if (token.endsWith("-required")) return "validation-required";
  if (token.endsWith("-too-long")) return "validation-too-long";
  if (token.endsWith(" is not configured.")) return "service-not-configured";
  return null;
}

export function publicErrorCode(error: unknown): ApiErrorCode {
  if (error && typeof error === "object" && !(error instanceof Error)) {
    const record = error as Record<string, unknown>;
    for (const candidate of [asString(record.message), asString(record.code)]) {
      const code = normalizePublicErrorToken(candidate);
      if (code) return code;
    }
  }
  const normalized = normalizePublicErrorToken(errorMessage(error));
  if (normalized) return normalized;
  return "internal-error";
}

export function publicErrorBody(error: unknown) {
  const retryAfterSeconds = error && typeof error === "object" && "retryAfterSeconds" in error
    && typeof error.retryAfterSeconds === "number" && Number.isFinite(error.retryAfterSeconds)
    ? Math.max(1, Math.ceil(error.retryAfterSeconds))
    : undefined;
  return retryAfterSeconds
    ? { code: publicErrorCode(error), retryAfterSeconds }
    : { code: publicErrorCode(error) };
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}
