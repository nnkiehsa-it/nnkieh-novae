import * as v from "valibot";
import { OPERATION_POLICIES, type OperationPolicyKey } from "../operation-policies.ts";
import { action, NoInput } from "../contract.ts";

function bounded(min: number, max: number) {
  return v.pipe(v.number(), v.integer(), v.minValue(min), v.maxValue(max));
}

/** Every runtime policy, each a whole number within the bounds an administrator may set. */
export const OperationPolicies = v.strictObject(
  Object.fromEntries(Object.entries(OPERATION_POLICIES).map(([key, spec]) => [key, bounded(spec.min, spec.max)])) as
    Record<OperationPolicyKey, ReturnType<typeof bounded>>,
  "validation-invalid",
);

/** The policies in force and the revision they were saved under. */
export const PolicySnapshot = v.object({
  revision: v.pipe(v.number(), v.integer(), v.minValue(0)),
  values: OperationPolicies,
});
export type PolicySnapshot = v.InferOutput<typeof PolicySnapshot>;

export const OPERATION_ACTIONS = {
  getRuntimePolicies: action({ group: "read", input: NoInput, output: PolicySnapshot }),
};
