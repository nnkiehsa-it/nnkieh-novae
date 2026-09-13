import { cloudinaryApiBaseUrl } from './cloudinary';
import { optionalEnv, requireEnv } from './env';

async function json(url: string, headers: Record<string, string>, body?: unknown) {
  const response = await fetch(url, { headers, method: body ? 'POST' : 'GET',
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`provider-http-${response.status}`);
  return await response.json() as Record<string, unknown>;
}

export async function providerDiagnostics(provider: string, options: { cursor?: string; until?: number; query?: string } = {}) {
  const checkedAt = new Date().toISOString();
  try {
    if (provider === 'cloudinary') {
      const usage = await json(`${cloudinaryApiBaseUrl()}/v1_1/${encodeURIComponent(requireEnv('CLOUDINARY_CLOUD_NAME'))}/usage`,
        { authorization: `Basic ${btoa(`${requireEnv('CLOUDINARY_API_KEY')}:${requireEnv('CLOUDINARY_API_SECRET')}`)}` });
      return { provider, status: 'available', checkedAt, data: Object.fromEntries(
        ['last_updated','plan','credits','storage','bandwidth','transformations','resources','requests'].map(key => [key, usage[key] ?? null]),
      ) };
    }
    if (provider === 'cloudflare' || provider === 'logs') {
      const account = optionalEnv('OPERATIONS_CLOUDFLARE_ACCOUNT_ID');
      const token = optionalEnv('OPERATIONS_CLOUDFLARE_TOKEN');
      const worker = optionalEnv('OPERATIONS_WORKER_NAME');
      if (!account || !token || !worker) return { provider, status: 'not-configured', checkedAt };
      if (provider === 'logs') {
        const until = options.until ?? Date.now();
        const response = await json(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/workers/observability/telemetry/query`,
          { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, {
            queryId: 'novae-admin-logs', dry: true, view: 'events', limit: 100,
            timeframe: { from: until - 86400000, to: until },
            ...(options.cursor ? { offset: options.cursor, offsetDirection: 'next' } : {}),
            parameters: { filters: [{ key: '$metadata.service', operation: 'eq', type: 'string', value: worker }],
              ...(options.query ? { needle: { value: options.query, isRegex: false } } : {}) },
          });
        if (response.success !== true) throw new Error('provider-query-rejected');
        const result = response.result as { events?: { events?: Array<{ $metadata: Record<string, unknown> }> } };
        const events = result.events?.events ?? [];
        return { provider,status:'available',checkedAt,until,
          nextCursor: events.length === 100 ? String(events[99].$metadata.id) : null,
          data: events.map(event => Object.fromEntries(['id','service','level','origin','requestId','rayId','region','duration','startTime','endTime'].map(key => [key,event.$metadata[key] ?? null]))) };
      }
      const data = await json('https://api.cloudflare.com/client/v4/graphql', { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, {
        query: `query($account: string, $worker: string, $start: string, $end: string) {
          viewer { accounts(filter: {accountTag: $account}) { workersInvocationsAdaptive(limit: 100,
            filter: {scriptName: $worker, datetime_geq: $start, datetime_leq: $end}) {
              sum { requests errors subrequests } quantiles { cpuTimeP50 cpuTimeP99 } dimensions { status }
          } } } }`,
        variables: { account, worker, start: new Date(Date.now()-86400000).toISOString(), end: checkedAt },
      });
      if (data.errors) throw new Error('provider-query-rejected');
      return { provider, status: 'available', checkedAt, data: data.data };
    }
    throw new Error('invalid-provider');
  } catch (error) {
    return { provider, status: 'unavailable', checkedAt, error: error instanceof Error ? error.message : 'provider-unavailable' };
  }
}
