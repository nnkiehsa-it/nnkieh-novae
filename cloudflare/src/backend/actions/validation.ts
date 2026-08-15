import { asString } from "../shared/http.ts";

export const INPUT_LIMITS = {
  title: 30,
  content: 1_000,
  contentStorage: 5_000,
  comment: 70,
  commentStorage: 2_000,
  issueResult: 2_000,
  facilityLocation: 120,
  facilityResult: 2_000,
  rejectionReason: 500,
  search: 120,
} as const;

const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\(\S+?(?:\s+["'][^"']*["'])?\)/gu;

export function requiredText(value: unknown, field: string, maxLength: number) {
  const text = asString(value);
  if (!text) throw new Error(`${field}-required`);
  if (text.length > maxLength) throw new Error(`${field}-too-long`);
  return text;
}

export function optionalText(value: unknown, field: string, maxLength: number) {
  const text = asString(value);
  if (text.length > maxLength) throw new Error(`${field}-too-long`);
  return text;
}

export function requiredMediaContent(
  value: unknown,
  field: string,
  maxTextLength: number,
  maxStorageLength: number,
) {
  const content = requiredText(value, field, maxStorageLength);
  const visibleText = content.replace(MARKDOWN_IMAGE_PATTERN, "").trim();
  if (visibleText.length > maxTextLength) throw new Error(`${field}-too-long`);
  return content;
}

export function optionalMediaContent(
  value: unknown,
  field: string,
  maxTextLength: number,
  maxStorageLength: number,
) {
  const content = optionalText(value, field, maxStorageLength);
  const visibleText = content.replace(MARKDOWN_IMAGE_PATTERN, "").trim();
  if (visibleText.length > maxTextLength) throw new Error(`${field}-too-long`);
  return content;
}
