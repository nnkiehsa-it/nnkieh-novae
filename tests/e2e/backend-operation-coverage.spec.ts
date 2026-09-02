import { expect, test } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { BACKEND_ACTION_POLICIES, type BackendActionName } from '../../src/services/backend-action-contract';

const PROVIDER_OR_AUTOMATION_ONLY_ACTIONS: Partial<Record<BackendActionName, string>> = {
  cacheUserAvatar: 'automatic Google profile projection; covered by backend/provider integration',
  deleteUploadedImages: 'automatic abandoned-upload rollback; browser covers create/finalize and integration fault-injects rollback',
  registerPushToken: 'requires a real browser PushSubscription and FCM registration; backend covered by integration',
  savePlatformFeatures: 'atomic backend primitive used by stress and transaction tests; product UI saves the complete category model',
  unregisterPushToken: 'requires an existing real FCM device registration; backend covered by integration',
};

test('every backend write is exercised by a browser journey or explicitly provider-owned', async () => {
  const directory = path.resolve('tests/e2e');
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  const sources = await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts') && entry.name !== 'backend-operation-coverage.spec.ts')
    .map((entry) => readFile(path.join(entry.parentPath, entry.name), 'utf8')));
  const browserSource = sources.join('\n');
  const writes = (Object.entries(BACKEND_ACTION_POLICIES) as Array<[
    BackendActionName,
    { group: string },
  ]>).filter(([, policy]) => policy.group !== 'read' && policy.group !== 'upload-resolve');
  const uncovered = writes
    .map(([action]) => action)
    .filter((action) => !browserSource.includes(`'${action}'`))
    .filter((action) => !PROVIDER_OR_AUTOMATION_ONLY_ACTIONS[action]);

  expect(uncovered, 'write actions without an E2E journey or provider-bound classification').toEqual([]);
  expect(Object.keys(PROVIDER_OR_AUTOMATION_ONLY_ACTIONS).sort()).toEqual([
    'cacheUserAvatar',
    'deleteUploadedImages',
    'registerPushToken',
    'savePlatformFeatures',
    'unregisterPushToken',
  ]);
});
