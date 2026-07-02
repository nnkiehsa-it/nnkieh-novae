<template>
  <div ref="containerRef" class="relative segmented-control flex items-center">
    <!-- Active sliding indicator pill -->
    <div
      class="absolute rounded-full bg-white dark:bg-ink-800 border border-ink-200/10 dark:border-ink-700/30 shadow-elevated pointer-events-none"
      :style="[indicatorStyle, { transition: 'all 240ms cubic-bezier(0.16, 1, 0.3, 1)' }]"
    ></div>

    <button
      v-for="item in options"
      :key="item.value"
      ref="buttonRefs"
      type="button"
      class="relative z-10 segmented-control__button"
      :class="modelValue === item.value ? activeClass : inactiveClass"
      :data-value="item.value"
      @click="emit('update:modelValue', item.value)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<script setup lang="ts" generic="TValue extends string">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps<{
  modelValue: TValue;
  options: readonly { label: string; value: TValue }[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: TValue];
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const buttonRefs = ref<HTMLButtonElement[]>([]);

const activeClass = 'text-ink-950 dark:text-ink-50 font-bold';
const inactiveClass = 'text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-200 font-medium';

const indicatorStyle = ref({
  left: '0px',
  width: '0px',
  top: '0px',
  height: '0px',
});


function updateIndicator() {
  nextTick(() => {
    const activeIndex = props.options.findIndex((opt) => opt.value === props.modelValue);
    const activeBtn = buttonRefs.value[activeIndex];
    if (activeBtn && containerRef.value) {
      const containerRect = containerRef.value.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();
      indicatorStyle.value = {
        left: `${btnRect.left - containerRect.left}px`,
        width: `${btnRect.width}px`,
        top: `${btnRect.top - containerRect.top}px`,
        height: `${btnRect.height}px`,
      };

      // Do NOT use scrollIntoView here: on mobile browsers, scrolling the page
      // collapses/expands the address bar which fires a window `resize` event.
      // scrollIntoView({ block: 'nearest' }) would then try to bring the
      // segmented-control's active button back into the viewport, causing the
      // whole page to jump back up. Instead, manipulate the container's
      // scrollLeft directly — this is purely horizontal and can never affect
      // the page's vertical scroll position.
      const targetScrollLeft =
        activeBtn.offsetLeft -
        containerRef.value.clientWidth / 2 +
        activeBtn.clientWidth / 2;
      containerRef.value.scrollTo({
        left: Math.max(0, targetScrollLeft),
        behavior: 'smooth',
      });
    }
  });
}

watch(
  () => props.modelValue,
  updateIndicator,
  { immediate: true }
);

onMounted(() => {
  window.addEventListener('resize', updateIndicator);
  // Initial call with a tiny delay to ensure proper calculation
  setTimeout(updateIndicator, 100);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateIndicator);
});
</script>
