import { computed, ref, type Ref } from 'vue';
import { registerActiveNavigationRefreshHandler } from '@/composables/useActiveNavigationRefresh';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { useInfiniteScroll } from '@/composables/useInfiniteScroll';
import { useLoadingTimeout } from '@/composables/useLoadingTimeout';
import { useMinimumLoading } from '@/composables/useMinimumLoading';
import { useI18n } from '@/i18n';
import { resetAppConnection } from '@/lib/reconnect';

type RefreshFeedbackMessages = {
  error: string;
  loading: string;
  success: string;
};

type ContentListRuntimeOptions = {
  canLoad?: Ref<boolean>;
  error: Ref<string>;
  hasMore: Ref<boolean>;
  loadMore: () => void | Promise<void>;
  loading: Ref<boolean>;
  loadingMore: Ref<boolean>;
  loadingTrigger?: Ref<unknown>;
  refresh: () => void | Promise<void>;
  refreshFeedback?: RefreshFeedbackMessages;
  scrollRoot?: Ref<HTMLElement | null>;
  timeoutMs?: number;
};

export function useContentListRuntime(options: ContentListRuntimeOptions) {
  const { t } = useI18n();
  const { start } = useActionFeedback();
  const refreshing = ref(false);
  const canLoad = options.canLoad ?? computed(() => true);
  const { visibleLoading } = useMinimumLoading(options.loading, {
    trigger: options.loadingTrigger,
  });
  const {
    hasProblem: loadingHasProblem,
    isOnline,
    problemDescription,
    problemTitle,
  } = useLoadingTimeout(options.loading, options.timeoutMs ?? 5_000);
  const infiniteScrollDisabled = computed(() =>
    !canLoad.value
    || !options.hasMore.value
    || options.loading.value
    || options.loadingMore.value
    || Boolean(options.error.value)
  );
  const { sentinel: loadMoreSentinel } = useInfiniteScroll({
    disabled: infiniteScrollDisabled,
    loading: options.loadingMore,
    onLoadMore: options.loadMore,
    root: options.scrollRoot,
  });

  async function retry() {
    await resetAppConnection();
    await options.refresh();
  }

  async function refreshFromNavigation() {
    if (refreshing.value) return;
    refreshing.value = true;
    const messages = options.refreshFeedback;
    const feedback = messages ? start(t(messages.loading)) : null;
    try {
      await options.refresh();
      if (messages) feedback?.succeed(t(messages.success));
    } catch (error) {
      if (messages) {
        feedback?.fail(t(messages.error));
        return;
      }
      throw error;
    } finally {
      refreshing.value = false;
    }
  }

  registerActiveNavigationRefreshHandler(refreshFromNavigation);

  return {
    isOnline,
    loadMoreSentinel,
    loadingHasProblem,
    problemDescription,
    problemTitle,
    retry,
    visibleLoading,
  };
}
