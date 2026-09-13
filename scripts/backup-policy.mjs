import { execFileSync } from 'node:child_process';
import { appendFile, readFile } from 'node:fs/promises';

if (!process.env.DATABASE_URL || !process.env.GITHUB_OUTPUT) throw new Error('Backup policy requires DATABASE_URL and GITHUB_OUTPUT.');
const raw = execFileSync('docker', ['run','--rm','--env','PGDATABASE','postgres:18-alpine','psql','-At','-v','ON_ERROR_STOP=1','--command',
  "select value from app_private.runtime_settings where key='operations_settings'"],
  { encoding: 'utf8', env: { ...process.env, PGDATABASE: process.env.DATABASE_URL } });
const { values } = JSON.parse(raw);
const specs = JSON.parse(await readFile(new URL('../config/operations.config.json',import.meta.url),'utf8'));
const keys = ['backupIntervalHours','backupCopies','backupRetentionDays'];
for (const key of keys) {
  if (!Number.isInteger(values[key]) || values[key] < specs[key].min || values[key] > specs[key].max) throw new Error(`Invalid backup policy: ${key}`);
}
if(values.backupIntervalHours * values.backupCopies > values.backupRetentionDays * 24) throw new Error('Backup lifetime does not cover the requested copies.');
await appendFile(process.env.GITHUB_OUTPUT, keys.map(key => `${key}=${values[key]}\n`).join(''));
console.log('Loaded administrator backup cadence and retention policy.');
