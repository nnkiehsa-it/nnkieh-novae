import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { authStateDir } from './paths';

export interface ContentState {
  announcement: string;
  facilityA: string;
  facilityB: string;
  proposalA: string;
  proposalB: string;
}

const path = resolve(authStateDir, 'content.json');

export async function readContentState() {
  return JSON.parse(await readFile(path, 'utf8')) as ContentState;
}

export async function writeContentState(state: ContentState) {
  await writeFile(path, JSON.stringify(state, null, 2), 'utf8');
}
