import { stripMarkdownImages } from '@/lib/format';

export function normalizeSearchText(value: string) {
  return stripMarkdownImages(value)
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/gu, ' ');
}

export function buildTitleSearchTokens(value: string, maxTokens = 10) {
  const characters = Array.from(normalizeSearchText(value)).filter((character) => character !== ' ');
  const tokenSize = characters.length >= 3 ? 3 : 2;
  const tokens = new Set<string>();

  for (let index = 0; index <= characters.length - tokenSize; index += 1) {
    tokens.add(characters.slice(index, index + tokenSize).join(''));
  }

  return [...tokens].slice(0, maxTokens);
}

