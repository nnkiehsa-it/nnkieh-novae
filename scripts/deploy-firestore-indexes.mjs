/* eslint-disable no-undef */
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
const accessToken = process.env.FIREBASE_ACCESS_TOKEN?.trim() ?? '';
const apply = process.argv.includes('--apply');

if (!projectId) {
  throw new Error('缺少 FIREBASE_PROJECT_ID。');
}

const localSpec = JSON.parse(await fs.readFile('.firestore.indexes.json', 'utf8'));
const localIndexes = Array.isArray(localSpec.indexes) ? localSpec.indexes : [];

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}\n${stderr || stdout}`));
    });
  });
}

function cloneField(field) {
  return {
    fieldPath: field.fieldPath,
    ...(field.order ? { order: field.order } : {}),
    ...(field.arrayConfig ? { arrayConfig: field.arrayConfig } : {}),
  };
}

function canonicalizeIndex(index) {
  const fields = (index.fields ?? []).map(cloneField);
  const lastField = fields.at(-1) ?? null;

  if (lastField?.fieldPath !== '__name__') {
    const lastOrderedField = [...fields].reverse().find((field) => typeof field.order === 'string');
    fields.push({
      fieldPath: '__name__',
      order: lastOrderedField?.order ?? 'ASCENDING',
    });
  }

  return {
    collectionGroup: index.collectionGroup,
    queryScope: index.queryScope ?? 'COLLECTION',
    fields,
  };
}

function indexKey(index) {
  return JSON.stringify(canonicalizeIndex(index));
}

function createPayload(index) {
  return {
    queryScope: index.queryScope ?? 'COLLECTION',
    fields: (index.fields ?? []).map(cloneField),
  };
}

const { stdout } = await run('npx', ['-y', 'firebase-tools@latest', 'firestore:indexes', '--json', '--project', projectId]);
const remoteSpec = JSON.parse(stdout);
const remoteIndexes = Array.isArray(remoteSpec.result?.indexes) ? remoteSpec.result.indexes : [];
const remoteKeys = new Set(remoteIndexes.map(indexKey));
const missingIndexes = localIndexes.filter((index) => !remoteKeys.has(indexKey(index)));

console.log(`Remote composite indexes: ${remoteIndexes.length}`);
console.log(`Local composite indexes: ${localIndexes.length}`);
console.log(`Missing composite indexes to deploy: ${missingIndexes.length}`);

if (!apply || missingIndexes.length === 0) {
  if (!apply) {
    console.log('Dry run only. Pass --apply to create missing indexes.');
  }
  process.exit(0);
}

if (!accessToken) {
  throw new Error('缺少 FIREBASE_ACCESS_TOKEN。請先提供可用的 Google access token。');
}

let createdCount = 0;
let skippedCount = 0;

for (const index of missingIndexes) {
  const payload = createPayload(index);
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/collectionGroups/${index.collectionGroup}/indexes`;

  console.log(`Creating index for ${index.collectionGroup}: ${JSON.stringify(payload.fields)}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    createdCount += 1;
    continue;
  }

  const errorText = await response.text();
  if (response.status === 409 || errorText.includes('already exists')) {
    skippedCount += 1;
    console.warn(`Skipping existing index for ${index.collectionGroup}.`);
    continue;
  }

  throw new Error(`建立索引失敗 (${response.status}): ${errorText}`);
}

console.log(`Created indexes: ${createdCount}`);
console.log(`Skipped existing indexes: ${skippedCount}`);
