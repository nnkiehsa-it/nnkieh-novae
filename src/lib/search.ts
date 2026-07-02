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

export function scoreTitleSearchMatch(title: string, query: string) {
  const normalizedTitle = normalizeSearchText(title);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;
  if (normalizedTitle === normalizedQuery) return 1000;
  if (normalizedTitle.startsWith(normalizedQuery)) return 800;
  if (normalizedTitle.includes(normalizedQuery)) return 600;

  const tokens = buildTitleSearchTokens(normalizedQuery);
  if (tokens.length === 0) return 0;
  const matchedTokens = tokens.filter((token) => normalizedTitle.includes(token)).length;
  return Math.round((matchedTokens / tokens.length) * 400);
}
