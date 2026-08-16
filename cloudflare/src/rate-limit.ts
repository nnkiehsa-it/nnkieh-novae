import { BACKEND_ACTION_POLICIES } from '../generated/backend-actions';
import type { ApiErrorCode } from '../generated/api-errors';
import type { Env, RateLimitBinding } from './types';

export class RateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(code: ApiErrorCode, retryAfterSeconds: number) {
    super(code);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function claim(binding: RateLimitBinding, key: string, code: ApiErrorCode, retryAfterSeconds: number) {
  const result = await binding.limit({ key });
  if (!result.success) throw new RateLimitError(code, retryAfterSeconds);
}

async function opaqueRateLimitKey(scope: string, identifier: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${scope}\0${identifier}`),
  );
  let binary = '';
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
}

const actionGroups = {
  read: { binding: 'READ_RATE_LIMITER', errorCode: 'rate-limit.read' },
  'general-write': { binding: 'WRITE_RATE_LIMITER', errorCode: 'rate-limit.operation' },
  'sensitive-write': { binding: 'SENSITIVE_WRITE_RATE_LIMITER', errorCode: 'rate-limit.operation' },
  'admin-write': { binding: 'ADMIN_WRITE_RATE_LIMITER', errorCode: 'rate-limit.admin-operation' },
  'upload-write': { binding: 'UPLOAD_WRITE_RATE_LIMITER', errorCode: 'rate-limit.image-write' },
  'upload-resolve': { binding: 'UPLOAD_RESOLVE_RATE_LIMITER', errorCode: 'rate-limit.image-read' },
} as const satisfies Record<string, { binding: keyof Env; errorCode: ApiErrorCode }>;

export async function claimInvalidAuthenticationIngress(
  env: Env,
  ip: string,
  code: ApiErrorCode,
) {
  await claim(env.INVALID_AUTH_IP_RATE_LIMITER, `invalid-auth:${ip}`, code, 60);
}

export async function claimActionRateLimit(env: Env, uid: string, action: string) {
  const policy = BACKEND_ACTION_POLICIES[action as keyof typeof BACKEND_ACTION_POLICIES];
  if (!policy) throw new Error('invalid-action');
  const group = actionGroups[policy.group];
  await claim(
    env[group.binding] as RateLimitBinding,
    await opaqueRateLimitKey(policy.group, uid),
    group.errorCode,
    10,
  );
}

export async function claimSyncUser(env: Env, uid: string) {
  await claim(
    env.SYNC_USER_RATE_LIMITER,
    await opaqueRateLimitKey('auth-sync', uid),
    'rate-limit.login-sync',
    60,
  );
}

export async function claimRealtimeTicketRateLimit(env: Env, uid: string) {
  await claim(
    env.READ_RATE_LIMITER,
    await opaqueRateLimitKey('realtime-ticket', uid),
    'rate-limit.read',
    10,
  );
}

export async function claimCloudinaryIngress(env: Env, ip: string) {
  await Promise.all([
    claim(env.WEBHOOK_IP_RATE_LIMITER, `ip:${ip}`, 'rate-limit.image-sync', 60),
    claim(env.WEBHOOK_GLOBAL_RATE_LIMITER, 'global', 'rate-limit.image-sync', 60),
  ]);
}
