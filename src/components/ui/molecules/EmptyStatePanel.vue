<template>
  <div
    class="flex w-full min-w-0 flex-col items-center justify-center px-6 py-12 text-center"
    :class="framed ? 'surface-card surface-pad-lg' : ''"
  >
    <IconTile
      size="lg"
      elevation="none"
      :tone="tone === 'danger' ? 'danger' : 'surface'"
    >
      <AppIcon :name="icon" :size="8" :stroke-width="1.5" />
    </IconTile>
    <h2 class="mt-5 text-xl font-semibold tracking-[0.015em] text-ink-950 dark:text-ink-50">
      {{ t(title) }}
    </h2>
    <p v-if="description" class="mt-2 text-sm leading-6 text-ink-500 dark:text-ink-400">
      {{ t(description) }}
    </p>
    <AppButton
      v-if="actionLabel"
      variant="secondary"
      class="mt-5"
      @click="emit('action')"
    >
      {{ t(actionLabel) }}
    </AppButton>
  </div>
</template>

<script setup lang="ts">
import AppButton from '@/components/ui/atoms/AppButton.vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import IconTile from '@/components/ui/atoms/IconTile.vue';
import { useI18n } from '@/i18n';

const { t } = useI18n();

withDefaults(defineProps<{
  actionLabel?: string;
  description?: string;
  framed?: boolean;
  icon?: 'chart' | 'comment' | 'lock' | 'warning' | 'inbox';
  title: string;
  tone?: 'default' | 'danger';
}>(), {
  actionLabel: '',
  description: '',
  framed: false,
  icon: 'chart',
  tone: 'default',
});

const emit = defineEmits<{
  action: [];
}>();

</script>
