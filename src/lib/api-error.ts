import { API_ERRORS, isApiErrorCode, type ApiErrorCode } from '@/generated/api-errors';
import { t } from '@/i18n';

export interface ApiErrorBody {
  code?: unknown;
  retryAfterSeconds?: unknown;
}

export interface ApiErrorResponse {
  error?: ApiErrorBody;
  requestId?: unknown;
}

interface ApiRequestErrorOptions {
  retryAfterSeconds?: number;
}

function normalizeRetryAfterSeconds(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.ceil(value)
    : undefined;
}

export class ApiRequestError extends Error {
  readonly code: ApiErrorCode;
  readonly messageKey: (typeof API_ERRORS)[ApiErrorCode]['messageKey'];
  readonly requestId?: string;
  readonly retryAfterSeconds?: number;
  readonly status: number;

  constructor(response: ApiErrorResponse, options: ApiRequestErrorOptions = {}) {
    const code = isApiErrorCode(response.error?.code) ? response.error.code : 'internal-error';
    const messageKey = API_ERRORS[code].messageKey;
    const requestId = typeof response.requestId === 'string' && response.requestId.trim()
      ? response.requestId.trim()
      : undefined;
    const retryAfterSeconds = normalizeRetryAfterSeconds(response.error?.retryAfterSeconds)
      ?? normalizeRetryAfterSeconds(options.retryAfterSeconds);
    const localizedMessage = t(messageKey);
    const message = retryAfterSeconds
      ? t('common.retryAfterSeconds', { message: localizedMessage, seconds: retryAfterSeconds })
      : localizedMessage;
    super(requestId ? t('service.errorTrackingCode', { message, requestId }) : message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.messageKey = messageKey;
    this.requestId = requestId;
    this.retryAfterSeconds = retryAfterSeconds;
    this.status = API_ERRORS[code].status;
  }
}
