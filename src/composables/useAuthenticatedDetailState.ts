import { computed } from 'vue';
import { useLoadingTimeout } from '@/composables/useLoadingTimeout';
import { useSession } from '@/composables/useSession';

export function useAuthenticatedDetailState() {
  const { initialized, isAllowedUser, loading } = useSession();
  const sessionLoading = computed(() => loading.value || !initialized.value);
  const canLoad = computed(() => initialized.value && isAllowedUser.value);
  const {
    hasProblem,
    isOnline,
    problemDescription,
    problemTitle,
  } = useLoadingTimeout(sessionLoading, 5_000);

  return {
    canLoad,
    isAllowedUser,
    sessionLoading,
    sessionLoadingHasProblem: hasProblem,
    sessionOnline: isOnline,
    sessionProblemDescription: problemDescription,
    sessionProblemTitle: problemTitle,
  };
}
