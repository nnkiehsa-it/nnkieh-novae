import { getSupabaseClient } from '@/lib/supabase';
import { withRequestTimeout } from '@/lib/request';

export interface BackendActionResult<TResponse> {
  data: TResponse;
}

export function invokeBackendAction<TRequest = Record<string, unknown>, TResponse = unknown>(
  name: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
) {
  const client = getSupabaseClient();

  return (payload: TRequest): Promise<BackendActionResult<TResponse>> => withRequestTimeout(
    async () => {
      const result = await client.functions.invoke<TResponse>('backendAction', {
        body: { action: name, payload },
      });
      if (result.error) {
        throw result.error;
      }
      if (result.data === null) {
        throw new Error('服務沒有回傳資料。');
      }
      return { data: result.data };
    },
    { label: name, signal: options.signal, timeoutMs: options.timeoutMs },
  );
}
