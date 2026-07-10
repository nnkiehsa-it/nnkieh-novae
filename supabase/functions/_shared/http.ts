export const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};
const MAX_JSON_BODY_BYTES = 64 * 1024;

export function handleCorsPreflight(request: Request) {
  return request.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders }) : null;
}

export function requireMethod(request: Request, method: string) {
  if (request.method === method) return null;
  return jsonResponse(
    { error: "method-not-allowed" },
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
  const message = errorMessage(error);
  if (message === "unauthenticated") return 401;
  if (message === "permission-denied") return 403;
  if (message === "not-found") return 404;
  if (message === "method-not-allowed") return 405;
  if (message === "missing action" || message.startsWith("Unsupported action:")) return 400;
  if (message === "unsupported-action") return 400;
  if (message === "invalid-json") return 400;
  if (message === "request-too-large") return 413;
  if (message === "invalid-issue-category" || message === "support-not-available") return 400;
  if (message.endsWith("-required") || message.endsWith("-too-long") || message === "invalid-status") return 400;
  if (message === "request-in-progress") return 409;
  if (message.includes("達到上限") || message.includes("太頻繁") || message.includes("上傳額度已用完")) return 429;
  if (message.endsWith(" is not configured.")) return 503;
  if (message === "rate-limit-provider-unavailable") return 503;
  return 500;
}

export async function readJsonRecord(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    throw new Error("request-too-large");
  }
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_JSON_BODY_BYTES) {
    throw new Error("request-too-large");
  }
  try {
    return asRecord(JSON.parse(body) as unknown);
  } catch {
    throw new Error("invalid-json");
  }
}

export function publicError(error: unknown) {
  const message = errorMessage(error);
  if (message.includes("達到上限") || message.includes("太頻繁") || message.includes("上傳額度已用完")) return message;
  const safeMessages: Record<string, string> = {
    "invalid-json": "請求格式不正確。",
    "invalid-issue-category": "提案分類不正確。",
    "invalid-status": "提案狀態不正確。",
    "method-not-allowed": "請求方法不正確。",
    "not-found": "找不到指定內容。",
    "permission-denied": "沒有執行此操作的權限。",
    "request-in-progress": "操作處理中，請稍後再試。",
    "request-too-large": "送出的內容超過限制。",
    "support-not-available": "此提案目前無法附議。",
    "unauthenticated": "請先登入後再操作。",
  };
  if (safeMessages[message]) return safeMessages[message];
  if (message.endsWith("-required")) return "請完整填寫必要內容。";
  if (message.endsWith("-too-long")) return "送出的文字超過長度限制。";
  return "服務暫時無法處理請求，請稍後再試。";
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}
