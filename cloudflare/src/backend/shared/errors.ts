import { API_ERRORS, isApiErrorCode, type ApiErrorCode } from "../../../../shared/api-errors.ts";
import { asString } from "./json.ts";

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

function normalizePublicErrorToken(token: string): ApiErrorCode | null {
  if (isApiErrorCode(token)) return token;
  const aliases: Record<string, ApiErrorCode> = {
    "missing-result": "validation-required",
    "unsupported-upload-target": "validation-invalid",
    "invalid-parent-comment": "validation-invalid",
    "facility-author-fixed": "support-not-available",
    "facility-closed": "support-not-available",
    "42501": "permission-denied",
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

export function publicErrorBody(error: unknown, failureId?: string) {
  const retryAfterSeconds = error && typeof error === "object" && "retryAfterSeconds" in error
    && typeof error.retryAfterSeconds === "number" && Number.isFinite(error.retryAfterSeconds)
    ? Math.max(1, Math.ceil(error.retryAfterSeconds))
    : undefined;
  const code = publicErrorCode(error);
  const publicMessage = error && typeof error === "object" && "publicMessage" in error
    && typeof error.publicMessage === "string"
    ? error.publicMessage.trim().slice(0, 500)
    : undefined;
  const result: { code: ApiErrorCode; message?: string; failureId?: string; retryAfterSeconds?: number } = { code };
  if (code === "account-restricted" && publicMessage) result.message = publicMessage;
  if (failureId) result.failureId = failureId;
  if (retryAfterSeconds) result.retryAfterSeconds = retryAfterSeconds;
  return result;
}
