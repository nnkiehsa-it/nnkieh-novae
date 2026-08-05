<template>
  <section class="relative min-w-0" :aria-label="t('comments.title')">
    <CommentComposer
      error=""
      target-id="unavailable-comments"
      disabled
      :submitting="false"
      :mobile-docked="mobileDocked"
    />
  </section>
</template>

<script setup lang="ts">
import CommentComposer from '@/components/CommentComposer.vue';
import { useI18n } from '@/i18n';

withDefaults(defineProps<{
  mobileDocked?: boolean;
}>(), {
  mobileDocked: false,
});

const { t } = useI18n();
</script>
