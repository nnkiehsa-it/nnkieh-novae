<template>
  <section class="w-full" aria-label="公告載入中" aria-busy="true">
    <article
      v-for="index in count"
      :key="index"
      class="border-b border-ink-200/90 py-4 dark:border-ink-800/90 sm:px-5"
    >
      <div class="space-y-3 animate-pulse">
        <div class="flex items-center gap-2">
          <span class="h-7 w-7 rounded-full bg-ink-200/60 dark:bg-ink-700/50"></span>
          <span class="h-3.5 w-28 rounded bg-ink-200/60 dark:bg-ink-700/50"></span>
          <span class="h-3.5 w-14 rounded bg-ink-200/60 dark:bg-ink-700/50"></span>
        </div>
        <span class="block h-5 w-2/3 rounded bg-ink-200/60 dark:bg-ink-700/50"></span>
        <div class="space-y-2">
          <span class="block h-4 w-full rounded bg-ink-200/60 dark:bg-ink-700/50"></span>
          <span class="block h-4 w-4/5 rounded bg-ink-200/60 dark:bg-ink-700/50"></span>
        </div>
        <div class="flex gap-2 pt-1">
          <span class="h-8 w-16 rounded-full bg-ink-200/60 dark:bg-ink-700/50"></span>
          <span class="h-8 w-16 rounded-full bg-ink-200/60 dark:bg-ink-700/50"></span>
        </div>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  count?: number;
}>(), {
  count: 5,
});
</script>
