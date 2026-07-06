interface FunctionErrorResult {
  error: unknown;
  response?: Response;
}

function errorFallback(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function formatFunctionError(message: unknown, requestId: unknown, fallback: string) {
  const readableMessage = typeof message === 'string' && message.trim()
    ? message.trim()
    : fallback;
  const readableRequestId = typeof requestId === 'string' && requestId.trim()
    ? requestId.trim()
    : '';
  return readableRequestId
    ? `${readableMessage} 錯誤追蹤碼：${readableRequestId}`
    : readableMessage;
}

export async function readSupabaseFunctionError(result: FunctionErrorResult) {
  const response = result.response;
  if (!response) {
    return errorFallback(result.error);
  }

  try {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const body = await response.clone().json() as Record<string, unknown>;
      const message = body.error ?? body.message;
      return formatFunctionError(message, body.requestId, errorFallback(result.error));
    }

    const text = await response.clone().text();
    return text.trim() || errorFallback(result.error);
  } catch {
    return errorFallback(result.error);
  }
}
