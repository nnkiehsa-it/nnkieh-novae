import { RequestFailure } from '@/lib/request';
import { ApiRequestError } from '@/lib/api-error';

export function toReadableBackendError(error: unknown) {
  if (error instanceof RequestFailure) return error;
  if (error instanceof ApiRequestError && error.code === 'service-not-configured') {
    return new Error('issue.serviceSetupIncomplete', { cause: error });
  }
  if (isContentUnavailableError(error)) {
    return new Error('issue.theContentNoLongerExists', { cause: error });
  }
  if (error instanceof ApiRequestError && error.code === 'permission-denied') {
    return new Error('access.operationForbidden', { cause: error });
  }
  if (error instanceof ApiRequestError && error.code === 'unauthenticated') {
    return new Error('issue.pleaseLogInBeforeContinuing', { cause: error });
  }
  if (error instanceof ApiRequestError) return error;
  return new Error('facility.theOperationFailedPleaseTryAgainLater', { cause: error });
}

export function isContentUnavailableError(error: unknown) {
  return error instanceof ApiRequestError && error.code === 'not-found';
}
