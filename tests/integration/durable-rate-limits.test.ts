import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { integrationTest } from './helpers';

integrationTest('real SQLite Durable Object enforces concurrent UID quotas, atomic batches and expiry alarms', async () => {
  const bundle = await build({ bundle: true, write: false, format: 'esm', platform: 'neutral',
    external: ['cloudflare:workers'], stdin: { resolveDir: process.cwd(), contents: `
      import { BusinessRateLimiter } from './cloudflare/src/durable/business-rate-limiter.ts';
      export class TestLimiter extends BusinessRateLimiter {
        async inspect() { return { count: this.ctx.storage.sql.exec('select count(*) as count from rate_limits').one().count,
          alarm: await this.ctx.storage.getAlarm() }; }
      }
      export default { async fetch(request, env) {
        const object = env.RATE.getByName(new URL(request.url).searchParams.get('uid'));
        return Response.json(request.method === 'GET' ? await object.inspect() : await object.claim(await request.json()));
      } }` } });
  const runtime = new Miniflare({ cf: false, workers: [{ config: {
    name: 'rate-test', type: 'worker', compatibilityDate: '2025-09-01',
    manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: bundle.outputFiles[0].text } } },
    exports: { TestLimiter: { type: 'durable-object', storage: 'sqlite' } },
    env: { RATE: { type: 'durable-object', worker: 'rate-test', exportName: 'TestLimiter' } },
  } }] });
  try {
    await runtime.ready;
    const expiresAtMs = Date.now() + 2000;
    const claim = { key: 'shared-window', limit: 3, units: 1, expiresAtMs, errorCode: 'rate-limit.operation' };
    async function send(uid: string, claims = [claim]) {
      const response = await runtime.dispatchFetch(`https://test.invalid/?uid=${uid}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' }, body: JSON.stringify(claims),
      });
      return await response.json() as { success: boolean; retryAfterSeconds?: number };
    }
    const burst = await Promise.all(Array.from({ length: 20 }, () => send('student-a')));
    assert.equal(burst.filter(row => row.success).length, 3);
    assert.ok(burst.filter(row => !row.success).every(row => Number(row.retryAfterSeconds) > 0));
    assert.equal((await send('student-b')).success, true, 'same school IP must not share UID quota');
    assert.equal((await send('student-b', [{ ...claim, key: 'uncommitted', limit: 10 }, { ...claim, limit: 1 }])).success, false);
    assert.equal((await send('student-b', [{ ...claim, key: 'uncommitted', limit: 1 }])).success, true, 'rejected batch must not consume another quota');
    await new Promise(resolve => setTimeout(resolve, Math.max(0,expiresAtMs-Date.now()) + 1500));
    const inspection = await (await runtime.dispatchFetch('https://test.invalid/?uid=student-a')).json() as { count: number };
    assert.equal(inspection.count, 0, 'alarm clears abandoned expired buckets without another claim');
  } finally { await runtime.dispose(); }
});
