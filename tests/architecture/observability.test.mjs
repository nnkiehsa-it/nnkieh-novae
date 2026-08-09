import assert from 'node:assert/strict';
import test from 'node:test';
import { read } from './helpers.mjs';

const edgeEntrypoints = [
  ['supabase/functions/backendAction/index.ts', 'backendAction'],
  ['supabase/functions/syncUser/index.ts', 'syncUser'],
  ['supabase/functions/cloudinaryWebhook/index.ts', 'cloudinaryWebhook'],
  ['supabase/functions/outboxWorker/index.ts', 'outboxWorker'],
  ['supabase/functions/processDeletionJobs/index.ts', 'processDeletionJobs'],
  ['supabase/functions/maintenanceCleanup/index.ts', 'maintenanceCleanup'],
];

test('Edge Functions use shared, privacy-safe Supabase log records', async () => {
  const observability = await read('supabase/functions/_shared/observability.ts');

  assert.match(observability, /createFunctionLogger/u);
  assert.match(observability, /invocationId/u);
  assert.match(observability, /durationMs/u);
  assert.match(observability, /publicErrorCode/u);
  assert.match(observability, /never pass request payloads, credentials, email addresses, or user profile data/u);

  for (const [path, functionName] of edgeEntrypoints) {
    const source = await read(path);
    assert.match(source, new RegExp(`createFunctionLogger\\("${functionName}"\\)`, 'u'));
    assert.doesNotMatch(source, /console\.(?:debug|error|info|log|warn)\(/u);
  }
});
