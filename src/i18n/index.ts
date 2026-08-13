import { useCallback, useSyncExternalStore } from "react";
import en from "@/i18n/messages/en";
import zhTW from "@/i18n/messages/zh-TW";
import { readLocalStorage, writeLocalStorage } from "@/lib/browser-storage";

export type AppLocale = "zh-TW" | "en";
export type TranslationParams = Record<string, string | number>;
export type MessageKey = keyof typeof zhTW;

const LOCALE_STORAGE_KEY = "novae:locale";
const supportedLocales = new Set<AppLocale>(["zh-TW", "en"]);
const catalogs: Record<AppLocale, Readonly<Record<string, string>>> = {
  en,
  "zh-TW": zhTW,
};
const listeners = new Set<() => void>();
let localeState: AppLocale = "zh-TW";
let initialized = false;

function normalizeLocale(value: string | null | undefined): AppLocale | null {
  if (!value) return null;
  if (supportedLocales.has(value as AppLocale)) return value as AppLocale;
  return value.toLowerCase().startsWith("en") ? "en" : "zh-TW";
}

function detectSystemLocale(): AppLocale {
  if (typeof navigator === "undefined") return "zh-TW";
  const languages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  return normalizeLocale(languages[0]) ?? "zh-TW";
}

function applyDocumentLocale(locale: AppLocale) {
  if (typeof document !== "undefined") document.documentElement.lang = locale;
}

function interpolate(message: string, params: TranslationParams) {
  return message.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key)
      ? String(params[key])
      : match,
  );
}

function translate(
  source: string,
  params: TranslationParams,
  locale: AppLocale,
) {
  const messages = catalogs[locale];
  return interpolate(
    Object.hasOwn(messages, source) ? messages[source] : source,
    params,
  );
}

function emitLocaleChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function initializeI18n() {
  if (initialized) return;
  initialized = true;
  const storedLocale = normalizeLocale(readLocalStorage(LOCALE_STORAGE_KEY));
  localeState = storedLocale ?? detectSystemLocale();
  applyDocumentLocale(localeState);
  if (!storedLocale) writeLocalStorage(LOCALE_STORAGE_KEY, localeState);
  emitLocaleChange();
}

export function setLocale(locale: AppLocale) {
  if (localeState === locale) return;
  localeState = locale;
  applyDocumentLocale(locale);
  writeLocalStorage(LOCALE_STORAGE_KEY, locale);
  emitLocaleChange();
}

export function t(source: string, params: TranslationParams = {}) {
  return translate(source, params, localeState);
}

export function getLocale() {
  return localeState;
}

export function useI18n() {
  const locale = useSyncExternalStore(
    subscribe,
    getLocale,
    (): AppLocale => "zh-TW",
  );
  const translateForLocale = useCallback(
    (source: string, params: TranslationParams = {}) =>
      translate(source, params, locale),
    [locale],
  );

  return { locale, setLocale, t: translateForLocale };
}
