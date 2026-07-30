import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const supportDir = dirname(fileURLToPath(import.meta.url));

export const authStateDir = resolve(supportDir, '../.auth');

export function authStatePath(user: string) {
  return resolve(authStateDir, `${user}.json`);
}
