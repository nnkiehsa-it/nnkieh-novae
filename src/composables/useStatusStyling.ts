import { computed, type Ref } from 'vue';
import type { FacilityStatus, IssueStatus } from '@/types';

type StyleVariant = 'table-row' | 'dialog' | 'dot' | 'button-text';

const variantClasses: Record<StyleVariant, Record<string, string>> = {
  'table-row': {
    'under-review': 'bg-review-container text-on-review-container',
    pending: 'bg-pending-container text-on-pending-container',
    processing: 'bg-processing-container text-on-processing-container',
    completed: 'bg-success-container text-on-success-container',
    'auto-rejected': 'bg-auto-rejected-container text-on-auto-rejected-container',
    'review-rejected': 'bg-error-container text-on-error-container',
    infeasible: 'bg-infeasible-container text-on-infeasible-container',
    'unable-to-handle': 'bg-infeasible-container text-on-infeasible-container',
    default: 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300',
  },
  'dialog': {
    'under-review': 'bg-review-container text-on-review-container',
    pending: 'bg-pending-container text-on-pending-container',
    processing: 'bg-processing-container text-on-processing-container',
    completed: 'bg-success-container text-on-success-container',
    'auto-rejected': 'bg-auto-rejected-container text-on-auto-rejected-container',
    'review-rejected': 'bg-error-container text-on-error-container',
    infeasible: 'bg-infeasible-container text-on-infeasible-container',
    'unable-to-handle': 'bg-infeasible-container text-on-infeasible-container',
    default: 'bg-ink-100 text-ink-700 dark:text-ink-300 dark:bg-ink-800/70',
  },
  'dot': {
    'under-review': 'bg-review',
    pending: 'bg-pending',
    processing: 'bg-processing',
    'auto-rejected': 'bg-auto-rejected',
    'review-rejected': 'bg-error',
    infeasible: 'bg-infeasible',
    'unable-to-handle': 'bg-infeasible',
    completed: 'bg-success',
    default: 'bg-ink-300',
  },
  'button-text': {
    'under-review': 'text-review',
    pending: 'text-pending',
    processing: 'text-processing',
    'auto-rejected': 'text-auto-rejected',
    'review-rejected': 'text-error',
    infeasible: 'text-infeasible',
    'unable-to-handle': 'text-infeasible',
    completed: 'text-success',
    default: 'text-ink-500',
  },
};

export function useStatusStyling(status: Readonly<Ref<IssueStatus | FacilityStatus>>, variant: StyleVariant = 'table-row') {
  const statusClass = computed(() => {
    const map = variantClasses[variant];
    return map[status.value] || map.default;
  });

  return { statusClass };
}
