import type { Env } from './types';
import { createDatabaseClient } from './backend/database/client';
import { loadOperationPolicies } from './backend/shared/operation-policies';

let cached: { expiresAt: number; pending: ReturnType<typeof read> } | undefined;
async function read(env: Env) {
  const database = await createDatabaseClient(env);
  try { return await loadOperationPolicies(database); }
  finally { await database.close(); }
}
export function mediaPolicies(env: Env) {
  if (!cached || cached.expiresAt <= Date.now()) {
    const entry = { expiresAt: Date.now() + 60_000, pending: read(env) };
    cached = entry;
    entry.pending.catch(() => { if (cached === entry) cached = undefined; });
  }
  return cached.pending;
}
