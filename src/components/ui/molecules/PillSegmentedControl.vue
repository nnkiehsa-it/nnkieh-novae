<template>
  <div
    class="segmented-control relative isolate flex items-center"
    :style="containerStyle"
  >
    <m.div
      class="segmented-control__indicator pointer-events-none absolute rounded-full border-0 bg-surface shadow-control dark:bg-ink-800"
      :class="{ 'segmented-control__indicator--equal': layout === 'equal' }"
      :animate="indicatorMotion"
      :transition="MOTION_SMOOTH_SPRING"
    />

    <m.button
      v-for="item in options"
      :key="item.value"
      type="button"
      :layout="layout === 'adaptive'"
      :transition="MOTION_SMOOTH_SPRING"
      class="segmented-control__button relative z-10 flex h-full items-center justify-center rounded-full text-xs font-semibold select-none"
      :class="[
        layout === 'equal' ? 'segmented-control__button--equal' : '',
        modelValue === item.value
          ? [activeClass, layout === 'equal' ? '' : 'segmented-control__button--active']
          : [inactiveClass, layout === 'equal' ? '' : 'segmented-control__button--compact'],
      ]"
      :title="item.title ?? item.label"
      :aria-label="item.ariaLabel ?? item.title ?? item.label"
      :aria-pressed="modelValue === item.value"
      :data-value="item.value"
      @click="emit('update:modelValue', item.value)"
    >
      <AppIcon class="segmented-control__icon" :name="item.icon" :size="3.5" />
      <span
        class="segmented-control__label"
        :class="{ 'segmented-control__label--visible': layout === 'equal' || modelValue === item.value }"
      >
        {{ item.label }}
      </span>
    </m.button>
  </div>
</template>

<script setup lang="ts" generic="TValue extends string">
import { computed } from 'vue';
import { m } from 'motion-v';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import type { AppIconName } from '@/components/ui/atoms/AppIcon.vue';
import { MOTION_SMOOTH_SPRING } from '@/lib/ui-motion';

export interface PillSegmentedControlOption<TValue extends string> {
  ariaLabel?: string;
  icon: AppIconName;
  label: string;
  title?: string;
  value: TValue;
}

const props = defineProps<{
  layout?: 'adaptive' | 'equal';
  modelValue: TValue;
  options: readonly PillSegmentedControlOption<TValue>[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: TValue];
}>();

const ACTIVE_SEGMENT_WIDTH_REM = 7;
const COMPACT_SEGMENT_WIDTH_REM = 2;
const SEGMENT_GAP_REM = 0.125;
const CONTROL_INLINE_PADDING_REM = 0.25;

const activeClass = 'text-ink-950 dark:text-ink-50';
const inactiveClass = 'text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200';
const indicatorMotion = computed(() => {
  const activeIndex = Math.max(0, props.options.findIndex((option) => option.value === props.modelValue));
  if (props.layout === 'equal') {
    return { x: `calc(${activeIndex * 100}% + ${activeIndex * SEGMENT_GAP_REM}rem)` };
  }
  return { x: `${activeIndex * (COMPACT_SEGMENT_WIDTH_REM + SEGMENT_GAP_REM)}rem` };
});
const containerStyle = computed(() => {
  const activeIndex = Math.max(0, props.options.findIndex((option) => option.value === props.modelValue));
  const geometry = {
    '--segment-active-index': String(activeIndex),
    '--segment-count': String(Math.max(1, props.options.length)),
  };
  if (props.layout === 'equal') {
    return {
      ...geometry,
      maxWidth: '100%',
      width: `${Math.max(12, props.options.length * 8)}rem`,
    };
  }
  const compactSegmentCount = Math.max(0, props.options.length - 1);
  const gapCount = Math.max(0, props.options.length - 1);
  const width = ACTIVE_SEGMENT_WIDTH_REM
    + compactSegmentCount * COMPACT_SEGMENT_WIDTH_REM
    + gapCount * SEGMENT_GAP_REM
    + CONTROL_INLINE_PADDING_REM;

  return { ...geometry, width: `${width}rem` };
});
</script>
