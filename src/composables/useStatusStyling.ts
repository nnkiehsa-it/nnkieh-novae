import { computed, type ComputedRef } from 'vue';
import type { IssueStatus } from '@/types';

type StyleVariant = 'table-row' | 'dialog' | 'dot' | 'button-text';

const variantClasses: Record<StyleVariant, Record<string, string>> = {
  'table-row': {
    'under-review': 'bg-secondary-container/50 border-secondary/20 text-on-secondary-container',
    processing: 'bg-secondary-container/60 border-secondary/20 text-on-secondary-container',
    completed: 'bg-primary-container/60 border-primary/20 text-on-primary-container',
    'auto-rejected': 'bg-warning-container/60 border-warning/20 text-on-warning-container',
    'review-rejected': 'bg-warning-container/60 border-warning/20 text-on-warning-container',
    infeasible: 'bg-warning-container/60 border-warning/20 text-on-warning-container',
    default: 'bg-ink-50/50 dark:bg-ink-950/30 border-ink-200 dark:border-ink-800 text-ink-600 dark:text-ink-400',
  },
  'dialog': {
    'under-review': 'border-secondary/30 bg-secondary-container/50 text-on-secondary-container',
    processing: 'border-secondary/30 bg-secondary-container/50 text-on-secondary-container',
    completed: 'border-primary/30 bg-primary-container/50 text-on-primary-container',
    'auto-rejected': 'border-warning/30 bg-warning-container/50 text-on-warning-container',
    'review-rejected': 'border-warning/30 bg-warning-container/50 text-on-warning-container',
    infeasible: 'border-warning/30 bg-warning-container/50 text-on-warning-container',
    default: 'border-ink-300 bg-ink-100 text-ink-700 dark:border-ink-700 dark:text-ink-300 dark:bg-ink-800/40',
  },
  'dot': {
    'under-review': 'bg-secondary',
    pending: 'bg-ink-500 dark:bg-ink-400',
    processing: 'bg-secondary',
    'auto-rejected': 'bg-warning',
    'review-rejected': 'bg-warning',
    infeasible: 'bg-warning',
    completed: 'bg-primary',
    default: 'bg-ink-300',
  },
  'button-text': {
    'under-review': 'text-secondary',
    pending: 'text-ink-900 dark:text-ink-100',
    processing: 'text-secondary',
    'auto-rejected': 'text-warning',
    'review-rejected': 'text-warning',
    infeasible: 'text-warning',
    completed: 'text-primary',
    default: 'text-ink-500',
  },
};

export function useStatusStyling(status: ComputedRef<IssueStatus>, variant: StyleVariant = 'table-row') {
  const statusClass = computed(() => {
    const map = variantClasses[variant];
    return map[status.value] || map.default;
  });

  return { statusClass };
}
