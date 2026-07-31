import { ref, watch, type Ref } from 'vue';
import { useIssueDisplay } from '@/composables/useIssueDisplay';
import { useIssueSupport } from '@/composables/useIssueSupport';
import { useStatusStyling } from '@/composables/useStatusStyling';
import type { IssueRecord } from '@/types';

export function useIssueItemController(
  issue: Ref<IssueRecord>,
  statusVariant: 'table-row',
  onSupportChanged: (payload: { issueId: string; supported: boolean; supportCount: number }) => void,
  onOpenDetails: (payload: { issue: IssueRecord; initialTab: 'details' | 'comments' }) => void,
) {
  const display = useIssueDisplay(issue);
  const currentUserSupported = ref(Boolean(issue.value.currentUserSupported));
  const supportCount = ref(issue.value.support_count);

  watch(
    () => [
      Boolean(issue.value.currentUserSupported),
      issue.value.support_count,
    ] as const,
    ([nextSupported, nextSupportCount]) => {
      currentUserSupported.value = nextSupported;
      supportCount.value = nextSupportCount;
    },
  );

  const { statusClass } = useStatusStyling(display.derivedStatus, statusVariant);
  const { supportClosed, supportProgressStyle, supportRemainingLabel, handleSupport } = useIssueSupport(
    issue,
    supportCount,
    currentUserSupported,
    display.remainingDays,
    display.derivedStatus,
    issue.value.id,
    (_event, payload) => onSupportChanged(payload),
  );

  function openDetails(initialTab: 'details' | 'comments' = 'details') {
    onOpenDetails({ issue: issue.value, initialTab });
  }

  return {
    ...display,
    currentUserSupported,
    supportCount,
    statusClass,
    supportClosed,
    supportProgressStyle,
    supportRemainingLabel,
    handleSupport,
    openDetails,
  };
}
