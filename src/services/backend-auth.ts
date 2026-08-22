import type { User } from 'firebase/auth';
import { withRequestTimeout } from '@/lib/request';
import { apiGatewayUrl, hasApiGatewayConfig } from '@/lib/api-gateway';
import { ApiRequestError, type ApiErrorResponse } from '@/lib/api-error';
import { backendSecurityHeaders } from '@/lib/backend-security';

interface SyncUserResponse extends ApiErrorResponse {
  ok?: boolean;
}

async function syncBackendProfile(
  user: User,
  firebaseToken: string,
) {
  const response = await withRequestTimeout(
    async (signal) => fetch(apiGatewayUrl('/v1/auth/sync'), {
      method: 'POST',
      body: JSON.stringify({ email: user.email }),
      headers: {
        ...(await backendSecurityHeaders(firebaseToken)),
        'Content-Type': 'application/json',
      },
      signal,
    }),
    { label: 'auth.backendLoginInitialization' },
  );
  let data: SyncUserResponse | null = null;
  try {
    data = await response.json() as SyncUserResponse;
  } catch {
    // Response validation below reports an invalid payload.
  }
  return { data, response };
}

function syncRequestError(data: SyncUserResponse | null) {
  return new ApiRequestError(data ?? { error: { code: 'upstream-invalid-response' } });
}

export async function ensureBackendProfile(
  user: User,
) {
  if (!hasApiGatewayConfig()) return;

  const token = await withRequestTimeout(
    () => user.getIdTokenResult(),
    { label: 'auth.backendLoginInitialization' },
  );

  const result = await syncBackendProfile(user, token.token);

  if (!result.response.ok || result.data?.ok !== true) {
    throw syncRequestError(result.data);
  }
}
