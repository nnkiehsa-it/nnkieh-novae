import * as v from "valibot";
import type { RateLimitName } from "./rate-limits.ts";

export type ActionGroup = "read" | "general-write" | "sensitive-write" | "admin-write" | "upload-write" | "upload-resolve";

/**
 * One backend action as both sides see it: the rate-limit group it is counted
 * in, any business limit it also counts against, what it accepts and what it
 * answers. The Worker parses every request with `input`; `output` is the
 * answer as it arrives on the wire (camelCase, timestamps as ISO strings).
 */
export interface ActionSpec<
  TInput extends v.GenericSchema = v.GenericSchema,
  TOutput extends v.GenericSchema = v.GenericSchema,
> {
  group: ActionGroup;
  extraLimit?: RateLimitName;
  /** A request that counts as one unit per uploaded image. */
  countsImages?: true;
  input: TInput;
  output: TOutput;
}

export function action<TInput extends v.GenericSchema, TOutput extends v.GenericSchema>(
  spec: ActionSpec<TInput, TOutput>,
) {
  return spec;
}

export function isWriteGroup(group: ActionGroup) {
  return group !== "read" && group !== "upload-resolve";
}

// Building blocks every contract is written in.

export const Uuid = v.pipe(v.string(), v.uuid());
export const Timestamp = v.pipe(v.string(), v.isoTimestamp());
export const NullableTimestamp = v.nullable(Timestamp);
export const Count = v.pipe(v.number(), v.integer(), v.minValue(0));
export const NoInput = v.object({});
export const Success = v.object({ success: v.literal(true) });

/**
 * Free text, trimmed. Length limits are runtime policies an administrator can
 * change, so they are enforced by the Worker against the policy in force rather
 * than fixed into the contract.
 */
export const Text = v.pipe(v.string(), v.trim());
export const RequiredText = v.pipe(Text, v.nonEmpty("validation-required"));
export const OptionalText = v.optional(Text, "");

export function pageSize(max: number, fallback: number) {
  return v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(max)), fallback);
}
