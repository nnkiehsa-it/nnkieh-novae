import { readdir, readFile, stat } from 'node:fs/promises';
import { URL } from 'node:url';

const root = new URL('../../', import.meta.url);

export const read = async (path) => readFile(new URL(path, root), 'utf8');

export async function listFiles(relativeDir, files = []) {
  const dir = new URL(relativeDir, root);
  for (const entry of await readdir(dir)) {
    if (['node_modules', 'dist', 'functions', '.git'].includes(entry)) continue;
    const child = new URL(`${relativeDir.replace(/\/?$/u, '/')}${entry}`, root);
    const childStat = await stat(child);
    if (childStat.isDirectory()) {
      await listFiles(`${relativeDir.replace(/\/?$/u, '/')}${entry}`, files);
    } else {
      files.push(child);
    }
  }
  return files;
}
