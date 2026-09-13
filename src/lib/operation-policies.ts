import { DEFAULT_OPERATION_POLICIES, type OperationPolicies } from '@/generated/operations';

let values: OperationPolicies = { ...DEFAULT_OPERATION_POLICIES };
export function setOperationPolicies(next: OperationPolicies) { values = { ...next }; }
export function getOperationPolicy(key: keyof OperationPolicies) { return values[key]; }
