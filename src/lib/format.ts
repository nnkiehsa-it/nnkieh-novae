import { getLocale, t } from '@/i18n';

export function getDeviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function formatDate(value: Date | null): string {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat(getLocale(), {
    timeZone: getDeviceTimeZone(),
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

export function formatDateOnly(value: Date | null): string {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat(getLocale(), {
    timeZone: getDeviceTimeZone(),
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(value);
}

export function stripMarkdownImages(text: string): string {
  return text.replace(/!\[[^\]]*]\((\S+?)(?:\s+["'][^"']*["'])?\)/g, '');
}

export function formatRelativeTime(value: Date | null): string {
  if (!value) {
    return '';
  }

  const now = Date.now();
  const diffMs = now - value.getTime();
  if (diffMs < 0) {
    return formatDateOnly(value);
  }

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) {
    return t('common.timeJustNow');
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return t('common.timeMinutesAgo', { count: diffMin });
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return t('common.timeHoursAgo', { count: diffHours });
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return t('common.timeDaysAgo', { count: diffDays });
  }

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) {
    return t('common.timeWeeksAgo', { count: diffWeeks });
  }

  return formatDateOnly(value);
}

