import { BACKEND_ACTION_POLICIES } from '../generated/backend-actions';
import { RATE_LIMITS } from '../generated/rate-limits';
import type { Env, JsonRecord } from './types';

interface Window {
  expiresAt: Date;
  startsAt: Date;
}

interface Claim {
  actionName: string;
  identifier: string;
  limit: number;
  message: string;
  units?: number;
  window: Window;
}

export class RateLimitError extends Error {
  readonly retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message);
    this.retryAfter = retryAfter;
  }
}

function fixedWindow(milliseconds: number, date = new Date()) {
  const startsAt = new Date(Math.floor(date.getTime() / milliseconds) * milliseconds);
  return { startsAt, expiresAt: new Date(startsAt.getTime() + milliseconds) };
}

const secondWindow = () => fixedWindow(1000);
const minuteWindow = () => fixedWindow(60_000);
const hourWindow = () => fixedWindow(3_600_000);

function taipeiDayWindow(date = new Date()) {
  const offset = 8 * 60 * 60 * 1000;
  const shifted = date.getTime() + offset;
  const start = Math.floor(shifted / 86_400_000) * 86_400_000 - offset;
  return { startsAt: new Date(start), expiresAt: new Date(start + 86_400_000) };
}

function sanitize(value: string) {
  return value.replace(/[^a-zA-Z0-9_.:-]/gu, '_').slice(0, 160);
}

function rateKey(claim: Claim) {
  return `srp:rate:${sanitize(claim.actionName)}:${sanitize(claim.identifier)}:${claim.window.startsAt.toISOString()}`;
}

function countFromResult(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('rate-limit-provider-unavailable');
  const record = value as Record<string, unknown>;
  if (typeof record.error === 'string') throw new Error('rate-limit-provider-unavailable');
  const count = typeof record.result === 'string' ? Number.parseInt(record.result, 10) : record.result;
  if (typeof count !== 'number' || !Number.isFinite(count)) throw new Error('rate-limit-provider-unavailable');
  return count;
}

export async function claimRateLimits(env: Env, claims: Claim[]) {
  const response = await fetch(`${env.UPSTASH_REDIS_REST_URL.replace(/\/+$/u, '')}/pipeline`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(claims.map((claim) => [
      'EVAL',
      "local count=redis.call('INCRBY',KEYS[1],ARGV[2]); if count==tonumber(ARGV[2]) then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return count",
      '1',
      rateKey(claim),
      String(Math.max(1, Math.ceil((claim.window.expiresAt.getTime() - Date.now()) / 1000))),
      String(Math.max(1, Math.round(claim.units ?? 1))),
    ])),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('rate-limit-provider-unavailable');
  const results = await response.json() as unknown;
  if (!Array.isArray(results) || results.length !== claims.length) throw new Error('rate-limit-provider-unavailable');
  for (let index = 0; index < claims.length; index += 1) {
    if (countFromResult(results[index]) > claims[index].limit) {
      throw new RateLimitError(
        claims[index].message,
        Math.max(1, Math.ceil((claims[index].window.expiresAt.getTime() - Date.now()) / 1000)),
      );
    }
  }
}

function groupClaims(uid: string, group: keyof typeof groupConfig) {
  const config = groupConfig[group];
  return [
    { identifier: uid, actionName: `${config.prefix}.second`, window: secondWindow(), ...config.second },
    { identifier: uid, actionName: config.prefix, window: hourWindow(), ...config.hourly },
  ];
}

const groupConfig = {
  read: { prefix: 'backend.read', second: RATE_LIMITS.backendActionReadSecond, hourly: RATE_LIMITS.backendActionReadHourly },
  'general-write': { prefix: 'backend.write', second: RATE_LIMITS.backendActionWriteSecond, hourly: RATE_LIMITS.backendActionWriteHourly },
  'sensitive-write': { prefix: 'backend.sensitive-write', second: RATE_LIMITS.backendActionSensitiveWriteSecond, hourly: RATE_LIMITS.backendActionSensitiveWriteHourly },
  'admin-write': { prefix: 'backend.admin-write', second: RATE_LIMITS.backendActionAdminWriteSecond, hourly: RATE_LIMITS.backendActionAdminWriteHourly },
  'upload-write': { prefix: 'backend.upload-write', second: RATE_LIMITS.imageUploadWriteSecond, hourly: RATE_LIMITS.imageUploadWriteHourly },
  'upload-resolve': { prefix: 'backend.upload-resolve', second: RATE_LIMITS.backendActionUploadResolveSecond, hourly: RATE_LIMITS.backendActionUploadResolveHourly },
} as const;

const extraConfig = {
  issueCreateDaily: { actionName: 'issue.create', window: taipeiDayWindow, config: RATE_LIMITS.issueCreateDaily },
  facilityCreateDaily: { actionName: 'facility.create', window: taipeiDayWindow, config: RATE_LIMITS.facilityCreateDaily },
  facilityAffectedToggleHourly: { actionName: 'facility.affected', window: hourWindow, config: RATE_LIMITS.facilityAffectedToggleHourly },
  facilityStatusUpdateHourly: { actionName: 'facility.status', window: hourWindow, config: RATE_LIMITS.facilityStatusUpdateHourly },
  commentCreateHourly: { actionName: 'comment.create', window: hourWindow, config: RATE_LIMITS.commentCreateHourly },
  imageUploadDaily: { actionName: 'image_upload.create', window: taipeiDayWindow, config: RATE_LIMITS.imageUploadDaily },
  avatarCacheDaily: { actionName: 'avatar.cache', window: taipeiDayWindow, config: RATE_LIMITS.avatarCacheDaily },
  supportToggleHourly: { actionName: 'support.toggle', window: hourWindow, config: RATE_LIMITS.supportToggleHourly },
  announcementLikeHourly: { actionName: 'announcement.like', window: hourWindow, config: RATE_LIMITS.announcementLikeHourly },
  pushTokenWriteHourly: { actionName: 'push-token.write', window: hourWindow, config: RATE_LIMITS.pushTokenWriteHourly },
} as const;

export async function claimActionRateLimits(env: Env, uid: string, action: string, body: JsonRecord) {
  const policy = BACKEND_ACTION_POLICIES[action as keyof typeof BACKEND_ACTION_POLICIES];
  if (!policy) throw new Error('unsupported-action');
  const claims: Claim[] = groupClaims(uid, policy.group);
  if ('extraLimit' in policy) {
    const extra = extraConfig[policy.extraLimit];
    const payload = body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
      ? body.payload as JsonRecord
      : {};
    const units = 'unitsPath' in policy && policy.unitsPath === 'payload.images' && Array.isArray(payload.images)
      ? Math.max(1, payload.images.length)
      : 1;
    claims.push({ identifier: uid, actionName: extra.actionName, window: extra.window(), units, ...extra.config });
  }
  await claimRateLimits(env, claims);
}

export async function claimSyncIngress(env: Env, ip: string) {
  await claimRateLimits(env, [
    { identifier: `ip:${ip}`, actionName: 'auth.sync.ingress.second', window: secondWindow(), ...RATE_LIMITS.loginSyncIngressSecond },
    { identifier: `ip:${ip}`, actionName: 'auth.sync.ingress', window: hourWindow(), ...RATE_LIMITS.loginSyncIngressHourly },
  ]);
}

export async function claimSyncUser(env: Env, uid: string) {
  await claimRateLimits(env, [
    { identifier: uid, actionName: 'auth.sync', window: hourWindow(), ...RATE_LIMITS.loginSyncHourly },
  ]);
}

export async function claimCloudinaryIngress(env: Env, ip: string) {
  await claimRateLimits(env, [
    { identifier: `ip:${ip}`, actionName: 'cloudinary.webhook.ingress.second', window: secondWindow(), ...RATE_LIMITS.cloudinaryWebhookSecond },
    { identifier: `ip:${ip}`, actionName: 'cloudinary.webhook.ingress', window: minuteWindow(), ...RATE_LIMITS.cloudinaryWebhookMinute },
    { identifier: 'global', actionName: 'cloudinary.webhook.second', window: secondWindow(), ...RATE_LIMITS.cloudinaryWebhookSecond },
    { identifier: 'global', actionName: 'cloudinary.webhook', window: minuteWindow(), ...RATE_LIMITS.cloudinaryWebhookMinute },
  ]);
}
