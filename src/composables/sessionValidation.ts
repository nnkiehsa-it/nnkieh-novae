import type { IdTokenResult, User } from 'firebase/auth';
import { allowedDomain } from '@/lib/firebase';
import type { ValidationResult } from '@/composables/sessionTypes';
import { debugLog } from '@/composables/sessionDebug';
import { withRequestTimeout } from '@/lib/request';

function getDomain(email: string | null | undefined) {
  const emailParts = String(email ?? '').trim().toLowerCase().split('@');
  return emailParts.length === 2 ? emailParts[1] : '';
}

function getGoogleIdentityCount(token: IdTokenResult) {
  const identities = token.claims.firebase?.identities;
  const googleIdentity = identities && typeof identities === 'object'
    ? (identities as Record<string, unknown>)['google.com']
    : null;

  return Array.isArray(googleIdentity) ? googleIdentity.length : 0;
}

export function validateBasicUser(user: User | null): ValidationResult {
  const expectedDomain = allowedDomain || '指定校內網域';

  if (!user?.email) {
    return {
      ok: false,
      reason: '目前登入帳號無法通過校內身分驗證。',
    };
  }

  if (!user.emailVerified) {
    return {
      ok: false,
      reason: '請先完成校內帳號驗證後再登入。',
    };
  }

  if (getDomain(user.email) !== allowedDomain) {
    return {
      ok: false,
      reason: `請使用 ${expectedDomain} 的校內帳號登入。`,
    };
  }

  return { ok: true, reason: '' };
}

export async function validateUserAgainstToken(user: User) {
  const token = await withRequestTimeout(() => user.getIdTokenResult(), { label: '登入驗證' });
  const email = String(token.claims.email ?? user.email ?? '').trim().toLowerCase();
  const signInProvider = String(token.claims.firebase?.sign_in_provider ?? '');
  const emailVerified = Boolean(token.claims.email_verified ?? user.emailVerified);
  const expectedDomain = allowedDomain || '指定校內網域';

  debugLog('token snapshot', {
    uid: user.uid,
    userEmail: user.email ?? '',
    tokenEmail: email,
    userEmailVerified: user.emailVerified,
    tokenEmailVerified: emailVerified,
    signInProvider,
    googleIdentityCount: getGoogleIdentityCount(token),
    expectedDomain,
    userProviders: user.providerData.map((provider) => provider.providerId),
  });

  if (!email) {
    return {
      ok: false,
      reason: '目前登入帳號無法通過校內身分驗證。',
    };
  }

  if (getDomain(email) !== allowedDomain) {
    return {
      ok: false,
      reason: `請使用 ${expectedDomain} 的校內帳號登入。`,
    };
  }

  if (!emailVerified) {
    return {
      ok: false,
      reason: '請先完成校內帳號驗證後再登入。',
    };
  }

  if (signInProvider !== 'google.com' && getGoogleIdentityCount(token) === 0) {
    return {
      ok: false,
      reason: '請使用指定的校內帳號登入方式。',
    };
  }

  return { ok: true, reason: '' };
}
