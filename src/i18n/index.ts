import { readonly, ref } from 'vue';
import en from '@/i18n/messages/en';
import zhTW from '@/i18n/messages/zh-TW';
import { readLocalStorage, writeLocalStorage } from '@/lib/browser-storage';

export type AppLocale = 'zh-TW' | 'en';
export type TranslationParams = Record<string, string | number>;
export type MessageKey = keyof typeof zhTW;

const LOCALE_STORAGE_KEY = 'novae:locale';
const supportedLocales = new Set<AppLocale>(['zh-TW', 'en']);
const localeState = ref<AppLocale>('zh-TW');
const catalogs: Record<AppLocale, Readonly<Record<string, string>>> = {
  en,
  'zh-TW': zhTW,
};
let initialized = false;

function normalizeLocale(value: string | null | undefined): AppLocale | null {
  if (!value) return null;
  if (supportedLocales.has(value as AppLocale)) return value as AppLocale;
  return value.toLowerCase().startsWith('en') ? 'en' : 'zh-TW';
}

function detectSystemLocale(): AppLocale {
  if (typeof navigator === 'undefined') return 'zh-TW';
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  return normalizeLocale(languages[0]) ?? 'zh-TW';
}

function applyDocumentLocale(locale: AppLocale) {
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}

function interpolate(message: string, params: TranslationParams) {
  return message.replace(/\{(\w+)\}/g, (match, key: string) => (
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
  ));
}

export function initializeI18n() {
  if (initialized) return;
  initialized = true;

  const storedLocale = normalizeLocale(readLocalStorage(LOCALE_STORAGE_KEY));

  const initialLocale = storedLocale ?? detectSystemLocale();
  localeState.value = initialLocale;
  applyDocumentLocale(initialLocale);

  if (!storedLocale) {
    writeLocalStorage(LOCALE_STORAGE_KEY, initialLocale);
  }
}

export function setLocale(locale: AppLocale) {
  localeState.value = locale;
  applyDocumentLocale(locale);
  writeLocalStorage(LOCALE_STORAGE_KEY, locale);
}

export function t(source: string, params: TranslationParams = {}) {
  const messages = catalogs[localeState.value];
  const message = Object.hasOwn(messages, source) ? messages[source] : source;
  return interpolate(message, params);
}

export function getLocale() {
  return localeState.value;
}

export function useI18n() {
  return {
    locale: readonly(localeState),
    setLocale,
    t,
  };
}
