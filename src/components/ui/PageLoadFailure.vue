<template>
  <div class="mx-auto flex max-w-xl flex-col items-center py-14 text-center">
    <div class="text-4xl font-bold tracking-tight text-ink-400 dark:text-ink-500" aria-hidden="true">{{ face }}</div>
    <h2 class="mt-5 text-xl font-bold text-ink-950 dark:text-ink-50">{{ title }}</h2>
    <p class="mt-2 text-sm text-ink-500 dark:text-ink-400">{{ description }}</p>
    <button type="button" class="button-secondary mt-5" :disabled="retryDisabled" @click="emit('retry')">
      {{ actionLabel }}
    </button>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  actionLabel?: string;
  description?: string;
  face?: string;
  retryDisabled?: boolean;
  title?: string;
}>(), {
  actionLabel: '重新整理',
  description: '資料等待時間過長，請檢查網路後再試一次。',
  face: '(；´д｀)ゞ',
  retryDisabled: false,
  title: '網路似乎有問題',
});

const emit = defineEmits<{
  retry: [];
}>();
</script>
