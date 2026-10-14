import { AsyncLocalStorage } from 'node:async_hooks';
import * as v from 'valibot';
import { OperationPolicies as OperationPoliciesSchema, PolicySnapshot as PolicySnapshotSchema } from "../../../../shared/contracts/operations.ts";
import type { OperationPolicies } from "../../../../shared/operation-policies.ts";
import type { DatabaseSession } from '../database/client';
import type { Selected } from '../database/schema';

const activePolicies = new AsyncLocalStorage<PolicySnapshot>();
type PolicySnapshot = v.InferOutput<typeof PolicySnapshotSchema>;

/**
 * How long an isolate may answer from the settings it has already read.
 *
 * Every entry point needs the policies, and reading them cost one round trip
 * per request even though they change a few times a year. An isolate reads
 * them once a minute instead; a saved change reaches the rest of the world
 * within that minute, and the console that edits them always reads afresh so
 * it can never write against a revision it did not see.
 */
const POLICY_READ_MAX_AGE_MS = 60_000;
let reading: { expiresAt: number; pending: Promise<PolicySnapshot> } | undefined;

export function validateOperationPolicies(value: unknown): OperationPolicies {
  const result = v.safeParse(OperationPoliciesSchema, value);
  if (!result.success) throw new Error('validation-invalid');
  return result.output;
}

/** The stored settings, as they are right now. */
export async function readOperationPolicies(database: DatabaseSession): Promise<PolicySnapshot> {
  const setting = await database.sqlOne<Selected<'runtime_settings', 'value'>>`
    select value from app_private.runtime_settings where key = 'operations_settings'`;
  return v.parse(PolicySnapshotSchema, JSON.parse(setting.value));
}

/** Lazily acquire a database only when the isolate needs a fresh snapshot. */
export function cachedOperationPolicies(load: () => Promise<PolicySnapshot>): Promise<PolicySnapshot> {
  if (!reading || reading.expiresAt <= Date.now()) {
    const entry = { expiresAt: Date.now() + POLICY_READ_MAX_AGE_MS, pending: load() };
    reading = entry;
    entry.pending.catch(() => { if (reading === entry) reading = undefined; });
  }
  return reading.pending;
}

/** Forgets the read, so the next one sees a change this isolate just made. */
export function forgetOperationPolicies() {
  reading = undefined;
}

/**
 * Runs the work with the policies in force, which is how everything under it
 * reads one: `operationPolicy('commentLength')` rather than a value threaded
 * through every call between here and there.
 */
export async function withOperationPolicies<T>(database: DatabaseSession, callback: () => Promise<T>): Promise<T> {
  const snapshot = await cachedOperationPolicies(() => readOperationPolicies(database));
  return activePolicies.run(snapshot, callback);
}

export function operationPolicy(key: keyof OperationPolicies) {
  return operationPolicies().values[key];
}

export function operationPolicies(): PolicySnapshot {
  const snapshot = activePolicies.getStore();
  if (!snapshot) throw new Error('operation-policies-not-loaded');
  return snapshot;
}
