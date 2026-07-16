<template>
  <PageLoadFailure
    v-if="problem"
    :title="problemTitle"
    :description="problemDescription"
    :retry-disabled="problemRetryDisabled"
    @retry="emit('retryProblem')"
  />

  <div
    v-else-if="loading"
    class="flex min-h-[50dvh] items-center justify-center"
    :aria-label="loadingLabel"
    aria-busy="true"
  >
    <LoadingSpinner :size="8" />
  </div>

  <div v-else-if="!allowed" class="sr-only" role="status">正在前往登入頁</div>

  <PageLoadFailure
    v-else-if="error"
    :title="errorTitle"
    :description="error"
    @retry="emit('retryError')"
  />

  <slot v-else />
</template>

<script setup lang="ts">
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import PageLoadFailure from '@/components/ui/PageLoadFailure.vue';

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
  errorTitle: '內容讀取失敗',
  problemRetryDisabled: false,
});

const emit = defineEmits<{
  retryError: [];
  retryProblem: [];
}>();
</script>
