import { AsyncLocalStorage } from "node:async_hooks";
import type { Env } from "../../types";

const runtimeEnvironment = new AsyncLocalStorage<Env>();

export function withRuntimeEnvironment<T>(env: Env, operation: () => T): T {
  return runtimeEnvironment.run(env, operation);
}

export function currentEnvironment() {
  const env = runtimeEnvironment.getStore();
  if (!env) throw new Error("runtime-environment-unavailable");
  return env;
}

export function requireEnv(name: keyof Env & string) {
  const value = currentEnvironment()[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is not configured.`);
  }
  return value.trim();
}

export function optionalEnv(name: keyof Env & string) {
  const value = currentEnvironment()[name];
  return typeof value === "string" ? value.trim() : "";
}
