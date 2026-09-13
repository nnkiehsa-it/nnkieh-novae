import { AsyncLocalStorage } from 'node:async_hooks';
import { OPERATION_POLICIES, type OperationPolicies } from '../../../generated/operations';
import type { DatabaseSession } from '../database/client';

const activePolicies = new AsyncLocalStorage<OperationPolicies>();
export interface PolicySnapshot { revision: number; values: OperationPolicies }

export function validateOperationPolicies(value: unknown): OperationPolicies {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('validation-invalid');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== Object.keys(OPERATION_POLICIES).length) throw new Error('validation-invalid');
  for (const [key, spec] of Object.entries(OPERATION_POLICIES)) {
    const number = input[key];
    if (typeof number !== 'number' || !Number.isInteger(number) || number < spec.min || number > spec.max) throw new Error('validation-invalid');
  }
  return input as OperationPolicies;
}

export async function loadOperationPolicies(database: DatabaseSession): Promise<PolicySnapshot> {
  const { data, error } = await database.table('app_private', 'runtime_settings')
    .select('value').eq('key', 'operations_settings').single();
  if (error) throw error;
  const stored = JSON.parse(data.value) as PolicySnapshot;
  return { revision: stored.revision, values: validateOperationPolicies(stored.values) };
}

export function withOperationPolicies<T>(policies: OperationPolicies, callback: () => T) {
  return activePolicies.run(policies, callback);
}

export function operationPolicy(key: keyof OperationPolicies) {
  const policies = activePolicies.getStore();
  if (!policies) throw new Error('operation-policies-not-loaded');
  return policies[key];
}
