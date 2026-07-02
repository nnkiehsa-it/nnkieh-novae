import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const READ_ACCESS_VALUES = ['school', 'owner-admin', 'reviewed-school'];
const AUTHOR_STORAGE_VALUES = ['issue', 'private'];
const RESPONSE_DEADLINE_START_VALUES = ['created', 'support-met', 'none'];
const UPLOAD_VISIBILITY_VALUES = ['private', 'school'];
const COMMENT_VISIBILITY_VALUES = ['private', 'school'];
const COMMENT_ENABLED_WHEN_VALUES = ['readable', 'public'];

function assertRecord(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }
  return value;
}

function assertString(value, message) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(message);
  }
  return value.trim();
}

function assertEnum(value, values, message) {
  const normalized = assertString(value, message);
  if (!values.includes(normalized)) {
    throw new Error(`${message} 可用值：${values.join(', ')}。`);
  }
  return normalized;
}

function assertNullablePositiveInteger(value, message) {
  if (value === null) {
    return null;
  }
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(message);
  }
  return value;
}

function assertBoolean(value, message) {
  if (typeof value !== 'boolean') {
    throw new Error(message);
  }
  return value;
}

function validateCategoryConfig(id, label, rawCategory) {
  if (!ID_PATTERN.test(id)) {
    throw new Error(`分類 id "${id}" 只能使用小寫英數與連字號。`);
  }

  const category = assertRecord(rawCategory, `分類 "${id}" 必須是物件。`);
  const support = assertRecord(category.support, `分類 "${id}" 缺少 support 設定。`);

  const readAccess = assertEnum(
    category.readAccess,
    READ_ACCESS_VALUES,
    `分類 "${id}" readAccess 不合法。`,
  );

  const rawAuthorVisible = assertBoolean(
    category.authorVisible,
    `分類 "${id}" authorVisible 必須是 boolean。`,
  );
  const authorVisible = readAccess === 'owner-admin' ? true : rawAuthorVisible;
  const authorStorage = authorVisible ? 'issue' : 'private';

  const supportEnabled = assertBoolean(support.enabled, `分類 "${id}" support.enabled 必須是 boolean。`);
  let supportGoal = null;
  let supportDeadlineDays = null;

  if (supportEnabled) {
    supportGoal = assertNullablePositiveInteger(
      support.goal,
      `分類 "${id}" support.goal 必須是正整數。`,
    );
    supportDeadlineDays = assertNullablePositiveInteger(
      support.deadlineDays,
      `分類 "${id}" support.deadlineDays 必須是正整數。`,
    );
    if (supportGoal === null || supportDeadlineDays === null) {
      throw new Error(`分類 "${id}" 啟用附議時必須設定 support.goal 與 support.deadlineDays。`);
    }
  }

  const responseDeadlineDays = assertNullablePositiveInteger(
    category.responseDeadlineDays,
    `分類 "${id}" responseDeadlineDays 必須是正整數或 null。`,
  );

  let responseDeadlineStart = 'none';
  if (responseDeadlineDays !== null) {
    responseDeadlineStart = supportEnabled ? 'support-met' : 'created';
  }

  return {
    id,
    label,
    readAccess,
    authorStorage,
    support: {
      enabled: supportEnabled,
      goal: supportGoal,
      deadlineDays: supportDeadlineDays,
      autoRejectUnmet: supportEnabled,
    },
    responseDeadline: {
      start: responseDeadlineStart,
      days: responseDeadlineDays,
    },
    uploads: {
      visibility: readAccess === 'owner-admin' ? 'private' : 'school',
    },
    comments: {
      visibility: readAccess === 'owner-admin' ? 'private' : 'school',
      enabledWhen: readAccess === 'reviewed-school' ? 'public' : 'readable',
    },
  };
}

export async function readIssueCategoryConfig(projectRoot) {
  const configPath = path.join(projectRoot, 'config', 'issue-categories.config.json');
  const raw = JSON.parse(await readFile(configPath, 'utf8'));
  const config = assertRecord(raw, 'issue-categories.config.json 必須是物件。');

  if (!Array.isArray(config.categories) || config.categories.length === 0) {
    throw new Error('issue-categories.config.json 必須提供至少一個 categories 項目。');
  }

  const seenIds = new Set();
  const categories = config.categories.map((entry, index) => {
    const category = assertRecord(entry, `第 ${index + 1} 個分類必須是物件。`);
    const id = assertString(category.id, `第 ${index + 1} 個分類缺少 id。`);
    const label = assertString(category.label, `第 ${index + 1} 個分類缺少 label。`);

    if (seenIds.has(id)) {
      throw new Error(`分類 id "${id}" 重複。`);
    }
    seenIds.add(id);

    return validateCategoryConfig(id, label, category);
  });

  return { categories };
}

export function issueCategoryIdsByTemplateField(config, field, value) {
  return config.categories
    .filter((category) => category[field] === value)
    .map((category) => category.id);
}

export function issueCategoryIdsWithAutoRejectUnmetSupport(config) {
  return config.categories
    .filter((category) => category.support.autoRejectUnmet === true)
    .map((category) => category.id);
}

function toTsLiteral(value) {
  return JSON.stringify(value, null, 2)
    .replace(/"id":/gu, 'id:')
    .replace(/"label":/gu, 'label:')
    .replace(/"readAccess":/gu, 'readAccess:')
    .replace(/"authorStorage":/gu, 'authorStorage:')
    .replace(/"support":/gu, 'support:')
    .replace(/"enabled":/gu, 'enabled:')
    .replace(/"goal":/gu, 'goal:')
    .replace(/"deadlineDays":/gu, 'deadlineDays:')
    .replace(/"autoRejectUnmet":/gu, 'autoRejectUnmet:')
    .replace(/"responseDeadline":/gu, 'responseDeadline:')
    .replace(/"start":/gu, 'start:')
    .replace(/"days":/gu, 'days:')
    .replace(/"uploads":/gu, 'uploads:')
    .replace(/"visibility":/gu, 'visibility:')
    .replace(/"comments":/gu, 'comments:')
    .replace(/"enabledWhen":/gu, 'enabledWhen:');
}

export function renderIssueCategoriesTs(config) {
  const categoriesLiteral = toTsLiteral(config.categories);

  return `/* This file is generated by scripts/generate-issue-categories.mjs. Do not edit manually. */

export type IssueReadAccess = 'school' | 'owner-admin' | 'reviewed-school';
export type IssueAuthorStorage = 'issue' | 'private';
export type IssueResponseDeadlineStart = 'created' | 'support-met' | 'none';
export type IssueUploadVisibility = 'private' | 'school';
export type IssueCommentVisibility = 'private' | 'school';
export type IssueCommentsEnabledWhen = 'readable' | 'public';

export interface IssueCategoryConfig {
  id: string;
  label: string;
  readAccess: IssueReadAccess;
  authorStorage: IssueAuthorStorage;
  support: {
    enabled: boolean;
    goal: number | null;
    deadlineDays: number | null;
    autoRejectUnmet: boolean;
  };
  responseDeadline: {
    start: IssueResponseDeadlineStart;
    days: number | null;
  };
  uploads: {
    visibility: IssueUploadVisibility;
  };
  comments: {
    visibility: IssueCommentVisibility;
    enabledWhen: IssueCommentsEnabledWhen;
  };
}

export const ISSUE_CATEGORIES = ${categoriesLiteral} as const satisfies readonly IssueCategoryConfig[];

export type IssueCategory = typeof ISSUE_CATEGORIES[number]['id'];

export const DEFAULT_ISSUE_CATEGORY: IssueCategory = ISSUE_CATEGORIES[0].id;
export const ISSUE_CATEGORY_IDS = ISSUE_CATEGORIES.map((category) => category.id) as IssueCategory[];
export const ISSUE_CATEGORY_LABELS = Object.fromEntries(
  ISSUE_CATEGORIES.map((category) => [category.id, category.label]),
) as Record<IssueCategory, string>;

const ISSUE_CATEGORY_BY_ID = ISSUE_CATEGORIES.reduce((lookup, category) => {
  lookup[category.id] = category;
  return lookup;
}, {} as Record<string, IssueCategoryConfig>);

export function isIssueCategory(value: unknown): value is IssueCategory {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ISSUE_CATEGORY_BY_ID, value);
}

export function getIssueCategoryConfig(category: string | null | undefined): IssueCategoryConfig | null {
  if (typeof category !== 'string') return null;
  return ISSUE_CATEGORY_BY_ID[category] ?? null;
}

export function getIssueCategoryConfigOrDefault(category: string | null | undefined): IssueCategoryConfig {
  return getIssueCategoryConfig(category) ?? ISSUE_CATEGORY_BY_ID[DEFAULT_ISSUE_CATEGORY];
}

export function getIssueCategoryLabel(category: string | null | undefined): string {
  return getIssueCategoryConfig(category)?.label ?? String(category ?? DEFAULT_ISSUE_CATEGORY);
}

export function getIssueCategoryIdsByReadAccess(readAccess: IssueReadAccess): IssueCategory[] {
  return ISSUE_CATEGORIES
    .filter((category) => category.readAccess === readAccess)
    .map((category) => category.id);
}

export function getIssueCategoryIdsWithAutoRejectUnmetSupport(): IssueCategory[] {
  return ISSUE_CATEGORIES
    .filter((category) => category.support.autoRejectUnmet)
    .map((category) => category.id);
}

export function issueAllowsSupport(category: string | null | undefined): boolean {
  return getIssueCategoryConfigOrDefault(category).support.enabled;
}

export function issueRequiresReview(category: string | null | undefined): boolean {
  return getIssueCategoryConfigOrDefault(category).readAccess === 'reviewed-school';
}

export function issueStoresAuthorPrivately(category: string | null | undefined): boolean {
  return getIssueCategoryConfigOrDefault(category).authorStorage === 'private';
}

export function issueIsPrivateToOwner(category: string | null | undefined): boolean {
  return getIssueCategoryConfigOrDefault(category).readAccess === 'owner-admin';
}

export function getIssueUploadVisibility(category: string | null | undefined): IssueUploadVisibility {
  return getIssueCategoryConfigOrDefault(category).uploads.visibility;
}

export function getIssueSupportGoal(category: string | null | undefined): number | null {
  return getIssueCategoryConfigOrDefault(category).support.goal;
}

export function getIssueSupportDeadlineDays(category: string | null | undefined): number | null {
  return getIssueCategoryConfigOrDefault(category).support.deadlineDays;
}

export function issueAutoRejectsUnmetSupport(category: string | null | undefined): boolean {
  return getIssueCategoryConfigOrDefault(category).support.autoRejectUnmet;
}

export function getIssueResponseDeadlineStart(category: string | null | undefined): IssueResponseDeadlineStart {
  return getIssueCategoryConfigOrDefault(category).responseDeadline.start;
}

export function getIssueResponseDeadlineDays(category: string | null | undefined): number | null {
  return getIssueCategoryConfigOrDefault(category).responseDeadline.days;
}

export function issueAllowsCommentsForStatus(
  category: string | null | undefined,
  status: string | null | undefined,
): boolean {
  const config = getIssueCategoryConfigOrDefault(category);
  if (config.comments.enabledWhen === 'public') {
    return status !== 'under-review' && status !== 'review-rejected';
  }
  return true;
}
`;
}
