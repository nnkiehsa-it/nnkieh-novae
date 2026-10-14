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
  /** How many units of `extraLimit` one request spends; one unless the action says otherwise. */
  units?(input: v.InferOutput<TInput>): number;
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
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:[.,](\d+))?(Z|([+-])(\d{2})(?::?(\d{2}))?)$/u;

/**
 * One spelling for every instant: UTC, `T`-separated, `Z`-terminated, with the
 * fraction kept to the digit. PostgreSQL text (`2026-01-02 03:04:05.123456+08`)
 * is not a format every browser parses, and a page cursor has to come back
 * exactly as precise as it left, so neither the separator nor the microseconds
 * are left to chance.
 */
export function canonicalTimestamp(value: string) {
  const match = TIMESTAMP.exec(value);
  if (!match) throw new Error(`Not a timestamp: ${value}`);
  const [, year, month, day, hour, minute, second, fraction = "", zone, sign, offsetHours = "0", offsetMinutes = "0"] = match;
  const offset = zone === "Z" ? 0 : (sign === "-" ? -1 : 1) * (Number(offsetHours) * 60 + Number(offsetMinutes));
  const utc = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute - offset, +second));
  return `${utc.toISOString().slice(0, 19)}${fraction ? `.${fraction}` : ""}Z`;
}

export const Timestamp = v.pipe(v.string(), v.isoTimestamp(), v.transform(canonicalTimestamp));
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
