<template>
  <section class="relative min-w-0" :aria-labelledby="headingId">
    <div
      class="flex items-center justify-between gap-3 pb-2"
      :class="{ 'max-md:hidden': compactHeader && !embedded }"
    >
      <div class="flex min-w-0 items-center gap-2">
        <AppIcon name="comment" class="shrink-0 text-ink-500" />
        <h4 :id="headingId" class="truncate whitespace-nowrap text-base font-semibold text-ink-900 dark:text-ink-100">
          {{ t('comments.title') }}
        </h4>
      </div>
      <TagBadge class="rounded-full border-none bg-ink-100 px-2.5 py-0.5 text-xs font-semibold dark:bg-ink-800/80">
        {{ t('comments.count', { count: 0 }) }}
      </TagBadge>
    </div>

    <CommentComposer
      error=""
      target-id="unavailable-comments"
      disabled
      :mobile-docked="mobileDocked"
    />
  </section>
</template>

<script setup lang="ts">
import { useId } from 'vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import TagBadge from '@/components/ui/atoms/TagBadge.vue';
import CommentComposer from '@/components/CommentComposer.vue';
import { useI18n } from '@/i18n';

withDefaults(defineProps<{
  compactHeader?: boolean;
  embedded?: boolean;
  mobileDocked?: boolean;
}>(), {
  compactHeader: false,
  embedded: false,
  mobileDocked: false,
});

const { t } = useI18n();
const headingId = `unavailable-comments-${useId()}`;
</script>
