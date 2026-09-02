import { API_ERRORS, isApiErrorCode, type ApiErrorCode } from '@/generated/api-errors';
import { t } from '@/i18n';

export interface ApiErrorBody {
  code?: unknown;
  message?: unknown;
  failureId?: unknown;
  retryAfterSeconds?: unknown;
}

export interface ApiErrorResponse {
  error?: ApiErrorBody;
  operationId?: unknown;
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
  readonly operationId?: string;
  readonly failureId?: string;
  readonly retryAfterSeconds?: number;
  readonly status: number;

  constructor(response: ApiErrorResponse, options: ApiRequestErrorOptions = {}) {
    const code = isApiErrorCode(response.error?.code) ? response.error.code : 'internal-error';
    const messageKey = API_ERRORS[code].messageKey;
    const operationId = typeof response.operationId === 'string' && response.operationId.trim()
      ? response.operationId.trim()
      : undefined;
    const failureId = typeof response.error?.failureId === 'string' && response.error.failureId.trim()
      ? response.error.failureId.trim()
      : undefined;
    const retryAfterSeconds = normalizeRetryAfterSeconds(response.error?.retryAfterSeconds)
      ?? normalizeRetryAfterSeconds(options.retryAfterSeconds);
    const localizedMessage = t(messageKey);
    const message = retryAfterSeconds
      ? t('common.retryAfterSeconds', { message: localizedMessage, seconds: retryAfterSeconds })
      : localizedMessage;
    const trackingId = failureId || operationId;
    super(trackingId ? t('service.errorTrackingCode', { message, trackingId }) : message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.messageKey = messageKey;
    this.operationId = operationId;
    this.failureId = failureId;
    this.retryAfterSeconds = retryAfterSeconds;
    this.status = API_ERRORS[code].status;
  }
}
