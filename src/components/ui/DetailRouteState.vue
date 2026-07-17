<template>
  <PageLoadFailure
    v-if="problem"
    :title="t(problemTitle)"
    :description="t(problemDescription)"
    :retry-disabled="problemRetryDisabled"
    @retry="emit('retryProblem')"
  />

  <SkeletonDetail
    v-else-if="loading"
    :label="loadingLabel"
  />

  <div v-else-if="!allowed" class="sr-only" role="status">{{ t('auth.redirectingToSignIn') }}</div>

  <PageLoadFailure
    v-else-if="error"
    :title="t(errorTitle)"
    :description="t(error)"
    @retry="emit('retryError')"
  />

  <slot v-else />
</template>

<script setup lang="ts">
import PageLoadFailure from '@/components/ui/PageLoadFailure.vue';
import SkeletonDetail from '@/components/ui/SkeletonDetail.vue';
import { useI18n } from '@/i18n';

const { t } = useI18n();

withDefaults(defineProps<{
  allowed: boolean;
  error?: string;
  errorTitle?: string;
  loading: boolean;
  loadingLabel: string;
  problem: boolean;
  problemDescription: string;
  problemRetryDisabled?: boolean;
  problemTitle: string;
}>(), {
  error: '',
  errorTitle: 'common.contentReadFailed',
  problemRetryDisabled: false,
});

const emit = defineEmits<{
  retryError: [];
  retryProblem: [];
}>();
</script>
