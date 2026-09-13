import { asString } from "../shared/http.ts";
import { operationPolicy } from "../shared/operation-policies.ts";

export const INPUT_LIMITS = {
  get title() { return operationPolicy('titleLength'); },
  get content() { return operationPolicy('contentLength'); },
  get contentStorage() { return operationPolicy('contentLength') + 4000; },
  get comment() { return operationPolicy('commentLength'); },
  get commentStorage() { return operationPolicy('commentLength') + 2000; },
  get issueResult() { return operationPolicy('resultLength'); },
  get facilityLocation() { return operationPolicy('locationLength'); },
  get facilityResult() { return operationPolicy('resultLength'); },
  rejectionReason: 500,
  get search() { return operationPolicy('searchLength'); },
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
