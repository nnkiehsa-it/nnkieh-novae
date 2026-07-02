import type { MarkdownImageRecord } from '@/types';

const markdownImagePattern = /!\[([^\]]*)]\((\S+?)(?:\s+["'][^"']*["'])?\)/g;
const sizedAltPattern = /^(.*)\|(\d+)x(\d+)$/;
const uploadUriScheme = 'srp-upload://';

function parseAlt(rawAlt: string) {
  const sizeMatch = rawAlt.match(sizedAltPattern);
  if (!sizeMatch) {
    return { alt: rawAlt.trim() };
  }

  return {
    alt: sizeMatch[1].trim(),
    width: Number(sizeMatch[2]),
    height: Number(sizeMatch[3]),
  };
}

export function extractMarkdownImages(content: string): MarkdownImageRecord[] {
  return Array.from(content.matchAll(markdownImagePattern)).map((match) => ({
    src: match[2],
    uploadId: getUploadIdFromUri(match[2] ?? '') ?? undefined,
    ...parseAlt(match[1] ?? ''),
  }));
}

export function stripMarkdownImages(content: string): string {
  return content.replace(markdownImagePattern, '').replace(/\n{3,}/g, '\n\n').trim();
}

export function getUploadIdFromUri(value: string) {
  if (!value.startsWith(uploadUriScheme)) {
    return null;
  }

  const uploadId = value.slice(uploadUriScheme.length).trim();
  return /^[a-zA-Z0-9_-]{8,80}$/.test(uploadId) ? uploadId : null;
}

export function getUploadIdsFromMarkdown(content: string) {
  return Array.from(new Set(
    extractMarkdownImages(content)
      .map((image) => image.uploadId)
      .filter((uploadId): uploadId is string => Boolean(uploadId)),
  ));
}

export function replaceMarkdownImageSources(
  content: string,
  urls: Record<string, string>,
  options: { unresolvedUpload?: 'keep' | 'remove' } = {},
) {
  return content.replace(markdownImagePattern, (raw, rawAlt: string, src: string) => {
    const uploadId = getUploadIdFromUri(src);
    if (!uploadId) {
      return raw;
    }

    if (!urls[uploadId]) {
      return options.unresolvedUpload === 'remove' ? '' : raw;
    }

    return `![${rawAlt}](${urls[uploadId]})`;
  }).replace(/\n{3,}/g, '\n\n').trim();
}
