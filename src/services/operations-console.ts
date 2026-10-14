import type { ActionRequest } from '@shared/actions.ts';
import type { OperationsConsole } from '@shared/contracts/operations.ts';
import { callAction } from '@/services/backend-action';
import { longRequestTimeoutMs } from '@/lib/request';

export type { OperationsConsole, PolicyChange, ProviderDiagnostic } from '@shared/contracts/operations.ts';

/** The queue and capacity, each panel handed over as it arrives. */
export function fetchOperationsConsole(
  page: number,
  options: { onPanel?: (panel: Partial<OperationsConsole>) => void } = {},
) {
  return callAction('getOperationsConsole', { page }, {
    onSegment: (key, data) => {
      if (key) options.onPanel?.({ [key]: data } as Partial<OperationsConsole>);
    },
  });
}

export function fetchOperationsQueue(page: number) {
  return callAction('getOperationsQueue', { page });
}

export function fetchOperationPolicies() {
  return callAction('getOperationPolicies', {});
}

export function saveOperationPolicies(input: ActionRequest<'saveOperationPolicies'>) {
  return callAction('saveOperationPolicies', input);
}

export function clearOperationalErrors() {
  return callAction('clearOperationalErrors', {});
}

export function clearScheduledWork() {
  return callAction('clearScheduledWork', {});
}

export function retryOperationalWork(input: ActionRequest<'retryOperationalWork'>) {
  return callAction('retryOperationalWork', input);
}

export function queueNotionArchiveRebuild() {
  return callAction('rebuildNotionArchive', {});
}

export function getProviderDiagnostics(input: ActionRequest<'getProviderDiagnostics'>) {
  return callAction('getProviderDiagnostics', input, { timeoutMs: longRequestTimeoutMs });
}
