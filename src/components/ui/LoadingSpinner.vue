<template>
  <svg
    class="text-current"
    :class="[sizeClass, $attrs.class]"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 60 60"
    aria-hidden="true"
    focusable="false"
  >
    <circle
      cx="50%"
      cy="50%"
      r="50%"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-width="5"
      stroke-dasharray="0% 314.159%"
      stroke-dashoffset="0%"
    >
      <animateTransform
        attributeName="transform"
        type="rotate"
        values="-90;810"
        keyTimes="0;1"
        dur="2s"
        repeatCount="indefinite"
      />
      <animate
        attributeName="stroke-dashoffset"
        values="0%;0%;-157.080%"
        calcMode="spline"
        keySplines="0.61, 1, 0.88, 1; 0.12, 0, 0.39, 0"
        keyTimes="0;0.5;1"
        dur="2s"
        repeatCount="indefinite"
      />
      <animate
        attributeName="stroke-dasharray"
        values="0% 314.159%;157.080% 157.080%;0% 314.159%"
        calcMode="spline"
        keySplines="0.61, 1, 0.88, 1; 0.12, 0, 0.39, 0"
        keyTimes="0;0.5;1"
        dur="2s"
        repeatCount="indefinite"
      />
    </circle>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(defineProps<{
  size?: number;
}>(), {
  size: 4,
});

const sizeMap: Record<number, string> = {
  3: 'h-3 w-3',
  3.5: 'h-3.5 w-3.5',
  4: 'h-4 w-4',
  5: 'h-5 w-5',
  6: 'h-6 w-6',
  8: 'h-8 w-8',
};
const sizeClass = computed(() => sizeMap[props.size] ?? 'h-4 w-4');
</script>

<style scoped>
svg {
  box-sizing: border-box;
  overflow: visible;
  padding: 0.125rem;
}

circle {
  fill: none;
  transform-origin: center;
}

@media (prefers-reduced-motion: reduce) {
  animate,
  animateTransform {
    display: none;
  }

  circle {
    stroke-dasharray: 78.54% 235.619%;
    stroke-dashoffset: 0;
  }
}
</style>
