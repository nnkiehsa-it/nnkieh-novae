import { DEFAULT_OPERATION_POLICIES, type OperationPolicies } from '@/generated/operations';

export interface PolicySnapshot { revision: number; values: OperationPolicies }

let snapshot: PolicySnapshot = { revision: 0, values: { ...DEFAULT_OPERATION_POLICIES } };
export function setOperationPolicies(next: PolicySnapshot) { snapshot = { revision: next.revision, values: { ...next.values } }; }
export function getOperationPolicy(key: keyof OperationPolicies) { return snapshot.values[key]; }
export function operationPolicyRevision() { return snapshot.revision; }
