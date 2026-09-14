import type { Env } from './types';
import { createDatabaseClient } from './backend/database/client';
import { operationPolicies, withOperationPolicies } from './backend/shared/operation-policies';

/**
 * The policies a signed media request runs under.
 *
 * Media is the one entry point with no database work of its own, so it opens a
 * connection for the settings alone; the shared read means it only does that
 * when nothing in this isolate has read them in the last minute.
 */
export async function mediaPolicies(env: Env) {
  const database = await createDatabaseClient(env);
  try { return await withOperationPolicies(database, async () => operationPolicies()); }
  finally { await database.close(); }
}
