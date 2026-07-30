import { GoogleAuthProvider, signInWithCredential, updateProfile } from 'firebase/auth';
import { allowedDomain, auth } from '@/lib/firebase';

const emulatorUrl = String(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL ?? '').trim();
const localEmulator = /^http:\/\/(?:127\.0\.0\.1|localhost):9099\/?$/u.test(emulatorUrl);

function fakeGoogleIdToken(email: string) {
  const encode = (value: unknown) => btoa(JSON.stringify(value))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    email,
    email_verified: true,
    name: email.split('@')[0],
    sub: `novae-e2e-${email.split('@')[0]}`,
  })}.`;
}

export async function signInForE2e(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!import.meta.env.DEV || !localEmulator || allowedDomain !== 'integration.invalid') {
    throw new Error('E2E authentication is only available in the isolated local emulator.');
  }
  if (!auth || !normalizedEmail.endsWith(`@${allowedDomain}`)) {
    throw new Error('Invalid E2E account.');
  }
  const credential = await signInWithCredential(
    auth,
    GoogleAuthProvider.credential(fakeGoogleIdToken(normalizedEmail)),
  );
  if (!credential.user.displayName) {
    await updateProfile(credential.user, { displayName: normalizedEmail.split('@')[0] });
  }
}
