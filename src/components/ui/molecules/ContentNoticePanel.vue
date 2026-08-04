<template>
  <SurfacePanel
    :variant="compact ? 'inset' : 'control'"
    class="!shadow-none !border-0 rounded-xl"
    :class="[
      compact ? 'px-3 py-2.5 text-xs' : 'px-4 py-3 text-sm',
      toneClass,
    ]"
  >
    <div v-if="compact" class="flex min-w-0 items-center justify-between gap-3">
      <div class="min-w-0 truncate"><slot /></div>
      <div v-if="$slots.trailing" class="shrink-0"><slot name="trailing" /></div>
    </div>
    <template v-else>
      <p v-if="title" class="font-semibold">{{ t(title) }}</p>
      <div :class="title ? 'mt-1 leading-6' : 'leading-6'"><slot /></div>
    </template>
  </SurfacePanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';
import { useI18n } from '@/i18n';

type ContentNoticeTone = 'error' | 'neutral' | 'success';

const props = withDefaults(defineProps<{
  compact?: boolean;
  title?: string;
  tone?: ContentNoticeTone;
}>(), {
  compact: false,
  title: '',
  tone: 'neutral',
});

defineSlots<{
  default(): unknown;
  trailing?(): unknown;
}>();

const { t } = useI18n();
const toneClass = computed(() => ({
  error: 'bg-error-container/80 text-on-error-container',
  neutral: 'bg-ink-100/60 text-ink-700 dark:bg-ink-900/40 dark:text-ink-200',
  success: 'bg-success-container/80 text-on-success-container',
})[props.tone]);
</script>
