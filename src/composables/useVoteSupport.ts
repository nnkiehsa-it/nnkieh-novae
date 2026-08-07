import { computed, ref, watch, type Ref } from 'vue';
import { useSession } from '@/composables/useSession';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { removeSupport, toggleSupport } from '@/services/issues';
import { isContentUnavailableError } from '@/services/issues-core';
import { useI18n } from '@/i18n';
import type { ActionPhase } from '@/composables/useActionFeedback';

interface VoteSupportOptions {
  authorFixed: Ref<boolean>;
  issueId: Ref<string>;
  currentUserSupported: Ref<boolean>;
  supportCount: Ref<number>;
  supportClosed: Ref<boolean>;
  statusLabel: Ref<string | undefined>;
  onSupported: (payload: { supported: boolean; supportCount: number }) => void;
  onContentUnavailable?: (issueId: string) => void;
}

export function useVoteSupport(options: VoteSupportOptions) {
  const { user } = useSession();
  const { show, start } = useActionFeedback();
  const { t } = useI18n();
  const busy = ref(false);
  const phase = ref<ActionPhase>('idle');
  const optimisticSupported = ref(options.currentUserSupported.value);

  watch(options.currentUserSupported, (value) => {
    optimisticSupported.value = value;
  });

  const displaySupportCount = computed(() => {
    if (optimisticSupported.value === options.currentUserSupported.value) {
      return options.supportCount.value;
    }

    let count = options.supportCount.value;
    if (options.currentUserSupported.value) {
      count -= 1;
    }
    if (optimisticSupported.value) {
      count += 1;
    }
    return count;
  });

  const supportVariant = computed<'icon-pill' | 'icon-pill-filled'>(() =>
    optimisticSupported.value
      ? 'icon-pill-filled'
      : 'icon-pill',
  );

  async function toggle() {
    if (options.authorFixed.value) {
      return;
    }
    if (!user.value) {
      show('issue.logInToSupportThisProposal', 'error');
      return;
    }

    if (options.supportClosed.value) {
      return;
    }

    const nextSupported = !optimisticSupported.value;
    const previousSupported = optimisticSupported.value;
    optimisticSupported.value = nextSupported;
    busy.value = true;
    phase.value = 'busy';
    const feedbackHandle = start(nextSupported ? 'common.addingSupport' : 'common.removingSupport');

    try {
      const result = nextSupported
        ? await toggleSupport(options.issueId.value)
        : await removeSupport(options.issueId.value);

      optimisticSupported.value = result.supported;
      options.onSupported({
        supported: result.supported,
        supportCount: result.support_count,
      });
      feedbackHandle.succeed(result.supported ? 'common.supportAdded' : 'common.supportRemoved');
      phase.value = 'success';
      await feedbackHandle.complete();
    } catch (err) {
      optimisticSupported.value = previousSupported;
      const errMsg = err instanceof Error ? err.message : '';
      if (isContentUnavailableError(err)) {
        feedbackHandle.fail(errMsg || 'issue.theProposalHasBeenDeletedAndCannotBeOperated');
        options.onContentUnavailable?.(options.issueId.value);
      } else if (errMsg.includes('permission-denied') || errMsg.toLowerCase().includes('permission denied')) {
        feedbackHandle.fail(
          options.statusLabel.value
            ? t('issue.support.closedStatus', { status: options.statusLabel.value })
            : 'issue.thisProposalSCurrentStatusDoesNotAllowSupport',
        );
      } else {
        feedbackHandle.fail('common.failedToAddSupportTryAgainLater');
      }
    } finally {
      phase.value = 'idle';
      busy.value = false;
    }
  }

  return {
    busy,
    phase,
    optimisticSupported,
    displaySupportCount,
    supportVariant,
    toggle,
  };
}
