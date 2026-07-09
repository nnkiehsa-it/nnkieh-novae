<template>
  <div
    ref="containerRef"
    class="segmented-control relative isolate flex items-center"
    :class="containerClass"
  >
    <div
      class="pointer-events-none absolute top-0 left-0 rounded-full border border-ink-200/10 bg-white shadow-elevated dark:border-ink-700/30 dark:bg-ink-800"
      :style="indicatorStyle"
    ></div>

    <button
      v-for="item in options"
      :key="item.value"
      ref="buttonRefs"
      type="button"
      class="segmented-control__button relative z-10 flex h-full items-center justify-center gap-1.5 rounded-full text-xs font-semibold select-none"
      :class="modelValue === item.value ? activeClass : inactiveClass"
      :title="item.title ?? item.label"
      :aria-label="item.ariaLabel ?? item.title ?? item.label"
      :aria-pressed="modelValue === item.value"
      :data-value="item.value"
      @click="emit('update:modelValue', item.value)"
    >
      <AppIcon v-if="item.icon" :name="item.icon" :size="3.5" />
      <span
        v-if="showInactiveLabels || modelValue === item.value"
        class="whitespace-nowrap transition-[opacity,transform,max-width] duration-200"
      >
        {{ item.label }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts" generic="TValue extends string">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import type { AppIconName } from '@/components/ui/AppIcon.vue';

export interface PillSegmentedControlOption<TValue extends string> {
  ariaLabel?: string;
  icon?: AppIconName;
  label: string;
  title?: string;
  value: TValue;
}

const props = withDefaults(defineProps<{
  containerClass?: string;
  modelValue: TValue;
  options: readonly PillSegmentedControlOption<TValue>[];
  showInactiveLabels?: boolean;
}>(), {
  containerClass: '',
  showInactiveLabels: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: TValue];
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const buttonRefs = ref<HTMLButtonElement[]>([]);

const activeClass = 'text-ink-950 dark:text-ink-50';
const inactiveClass = 'text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200';

const indicatorStyle = ref({
  height: '0px',
  transform: 'translate3d(0px, 0px, 0)',
  transition: 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), width 250ms cubic-bezier(0.25, 1, 0.5, 1)',
  width: '0px',
});

function updateIndicator() {
  void nextTick(() => {
    const activeIndex = props.options.findIndex((option) => option.value === props.modelValue);
    const activeButton = buttonRefs.value[activeIndex];
    const container = containerRef.value;
    if (!activeButton || !container) return;

    indicatorStyle.value = {
      height: `${activeButton.offsetHeight}px`,
      transform: `translate3d(${activeButton.offsetLeft}px, ${activeButton.offsetTop}px, 0)`,
      transition: 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), width 250ms cubic-bezier(0.25, 1, 0.5, 1)',
      width: `${activeButton.offsetWidth}px`,
    };

    const targetScrollLeft = activeButton.offsetLeft - container.clientWidth / 2 + activeButton.clientWidth / 2;
    container.scrollTo({
      behavior: 'smooth',
      left: Math.max(0, targetScrollLeft),
    });
  });
}

watch(
  () => [props.modelValue, props.options, props.showInactiveLabels],
  updateIndicator,
  { immediate: true },
);

onMounted(() => {
  window.addEventListener('resize', updateIndicator);
  window.setTimeout(updateIndicator, 100);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateIndicator);
});
</script>
