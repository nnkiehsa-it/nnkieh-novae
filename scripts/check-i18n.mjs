import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { API_ERRORS } from "../shared/api-errors.ts";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const catalogPaths = {
  en: path.join(sourceRoot, "i18n/messages/en"),
  zhTW: path.join(sourceRoot, "i18n/messages/zh-TW"),
};

function readCatalog(sourceText, variableName, filePath) {
  const messages = new Map();
  const duplicateKeys = [];
  if (!sourceText.includes(`const ${variableName} =`)) {
    return {
      duplicateKeys,
      messages,
      structureErrors: [`${filePath} has no ${variableName} catalog`],
    };
  }
  const propertyPattern =
    /^\s*(['"])([^'"]+)\1\s*:\s*(['"])((?:\\.|(?!\3).)*)\3,?\s*$/gmu;
  for (const match of sourceText.matchAll(propertyPattern)) {
    const key = match[2];
    const value = match[4]
      .replace(/\\n/gu, "\n")
      .replace(/\\(['"\\])/gu, "$1");
    if (messages.has(key)) duplicateKeys.push(key);
    messages.set(key, value);
  }
  return { duplicateKeys, messages };
}

async function readCatalogDirectory(directory) {
  const messages = new Map();
  const duplicateKeys = [];
  const structureErrors = [];
  const entries = await readdir(directory, { withFileTypes: true });
  const catalogFiles = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        entry.name !== "index.ts",
    )
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of catalogFiles) {
    const filePath = path.join(directory, entry.name);
    const domain = path.basename(entry.name, ".ts");
    const catalog = readCatalog(
      await readFile(filePath, "utf8"),
      "messages",
      filePath,
    );
    duplicateKeys.push(...catalog.duplicateKeys);
    for (const [key, value] of catalog.messages) {
      if (!key.startsWith(`${domain}.`)) {
        structureErrors.push(
          `${filePath} contains key outside its ${domain} domain: ${key}`,
        );
      }
      if (messages.has(key)) duplicateKeys.push(key);
      messages.set(key, value);
    }
  }

  return { duplicateKeys, messages, structureErrors };
}

async function listSourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["generated", "i18n"].includes(entry.name)) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listSourceFiles(entryPath)));
    else if (/\.(?:ts|tsx)$/u.test(entry.name)) files.push(entryPath);
  }
  return files;
}

function stripNonRuntimeText(source) {
  return source
    .replace(/<style\b[\s\S]*?<\/style>/giu, "")
    .replace(/<!--[\s\S]*?-->/gu, "")
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/(^|[^:])\/\/.*$/gmu, "$1");
}

const [zh, en, sourceFiles] = await Promise.all([
  readCatalogDirectory(catalogPaths.zhTW),
  readCatalogDirectory(catalogPaths.en),
  listSourceFiles(sourceRoot),
]);
const errors = [];
const allowedStaticTemplateText = new Set([
  "English",
  "Novae",
  "Novae campus participation platform",
]);
const nativeLanguageLabelKeys = new Set(["ui.settings.zhShort"]);
const deprecatedZhProductTerms = [
  "連署",
  "連屬",
  "設備回報",
  "設備報修",
  "報修",
  "校園提案",
  "討論留言",
];

function isLocaleKey(value) {
  return zh.messages.has(value);
}

for (const [locale, catalog] of [
  ["zh-TW", zh],
  ["en", en],
]) {
  errors.push(...catalog.structureErrors.map((error) => `${locale}: ${error}`));
  for (const key of catalog.duplicateKeys)
    errors.push(`${locale} has duplicate key: ${key}`);
  for (const [key, value] of catalog.messages) {
    if (!/^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)+$/u.test(key)) {
      errors.push(`${locale} has a non-semantic or invalid key: ${key}`);
    }
    if (/^text\.[0-9a-f]{8,}$/u.test(key)) {
      errors.push(`${locale} still has an opaque generated key: ${key}`);
    }
    if (key.length > 55)
      errors.push(`${locale} has an overly sentence-shaped key: ${key}`);
    if (!value.trim()) errors.push(`${locale} has an empty message: ${key}`);
  }
}
for (const key of zh.messages.keys()) {
  if (!en.messages.has(key)) errors.push(`English catalog is missing: ${key}`);
}
for (const key of en.messages.keys()) {
  if (!zh.messages.has(key))
    errors.push(`Traditional Chinese catalog is missing: ${key}`);
}
for (const [key, value] of zh.messages) {
  for (const term of deprecatedZhProductTerms) {
    if (value.includes(term)) {
      errors.push(`Traditional Chinese message uses deprecated product term "${term}": ${key}`);
    }
  }
}
for (const [key, value] of en.messages) {
  if (/\p{Script=Han}/u.test(value) && !nativeLanguageLabelKeys.has(key))
    errors.push(`English message still contains Han characters: ${key}`);
  if (
    !value.trimStart().startsWith("{") &&
    /^[\s"'“‘([\-—]*[a-z]/u.test(value)
  ) {
    errors.push(`English message must start with a capital letter: ${key}`);
  }
}
for (const [code, { messageKey }] of Object.entries(API_ERRORS)) {
  if (!zh.messages.has(messageKey)) {
    errors.push(`API error ${code} references a missing locale key: ${messageKey}`);
  }
}
for (const [key, zhValue] of zh.messages) {
  const enValue = en.messages.get(key);
  if (enValue === undefined) continue;
  const zhParams = [...zhValue.matchAll(/\{(\w+)\}/gu)]
    .map((match) => match[1])
    .sort();
  const enParams = [...enValue.matchAll(/\{(\w+)\}/gu)]
    .map((match) => match[1])
    .sort();
  if (zhParams.join("\0") !== enParams.join("\0")) {
    errors.push(`Locale interpolation parameters do not match: ${key}`);
  }
}

const usedLocaleKeys = new Set();
const directlyTranslatedKeys = new Set();
const localeNamespaces = [
  ...new Set([...zh.messages.keys()].map((key) => key.split(".")[0])),
];
const escapedNamespaces = localeNamespaces.map((namespace) =>
  namespace.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"),
);
const localeReferencePattern = new RegExp(
  `(['"])((?:${escapedNamespaces.join("|")})\\.[a-z][A-Za-z0-9]*(?:\\.[a-z][A-Za-z0-9]*)*)\\1`,
  "gu",
);
const nativeTags =
  /<(?:a|article|button|div|form|img|input|main|nav|p|section|span|textarea)\b[\s\S]*?>/giu;
const localizedPropertyPattern =
  /\b(?:caption|description|detail|label|message|shortLabel|statusLabel|subtitle|title)\s*:\s*(['"])([^'"]+)\1/gu;
for (const file of sourceFiles) {
  const source = await readFile(file, "utf8");
  const runtimeSource = stripNonRuntimeText(source);
  const relativePath = path.relative(root, file);
  for (const match of runtimeSource.matchAll(localeReferencePattern)) {
    if (isLocaleKey(match[2])) usedLocaleKeys.add(match[2]);
  }
  for (const match of runtimeSource.matchAll(/\bt\(\s*(['"])([^'"]+)\1/gu)) {
    directlyTranslatedKeys.add(match[2]);
  }
  for (const match of runtimeSource.matchAll(localizedPropertyPattern)) {
    if (!isLocaleKey(match[2]) && !allowedStaticTemplateText.has(match[2])) {
      errors.push(
        `${relativePath} contains a static user-facing object property: ${match[2]}`,
      );
    }
  }
  if (/\p{Script=Han}/u.test(runtimeSource)) {
    errors.push(
      `${relativePath} contains a hard-coded Han string outside the locale catalogs`,
    );
  }
  for (const tag of runtimeSource.matchAll(nativeTags)) {
    for (const attribute of tag[0].matchAll(
      /(?:aria-label|alt|placeholder|title)=(['"])([^'"]+)\1/gu,
    )) {
      if (isLocaleKey(attribute[2])) {
        errors.push(
          `${relativePath} exposes a locale key through a native element attribute`,
        );
      }
    }
  }
}

for (const key of usedLocaleKeys) {
  if (!zh.messages.has(key))
    errors.push(`Referenced locale key is missing from both catalogs: ${key}`);
}
for (const key of directlyTranslatedKeys) {
  if (!zh.messages.has(key))
    errors.push(`t(...) references a missing locale key: ${key}`);
}

if (errors.length) {
  console.error([...new Set(errors)].join("\n"));
  process.exit(1);
}

console.log(
  `i18n check passed: ${zh.messages.size} messages, ` +
    `${usedLocaleKeys.size} semantic and ${directlyTranslatedKeys.size} direct references.`,
);
