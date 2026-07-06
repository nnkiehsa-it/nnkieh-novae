<template>
  <svg
    class="text-current loading-spinner"
    :class="[sizeClass, $attrs.class]"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 60 60"
    aria-hidden="true"
    focusable="false"
  >
    <circle
      class="loading-spinner-circle"
      cx="50%"
      cy="50%"
      r="50%"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-width="5"
    />
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
.loading-spinner {
  box-sizing: border-box;
  overflow: visible;
  padding: 0.125rem;
}

.loading-spinner-circle {
  fill: none;
  transform-origin: center;
  stroke-dasharray: 0% 314.159%;
  stroke-dashoffset: 0%;
  animation:
    loading-spinner-dash 2s cubic-bezier(0.4, 0, 0.2, 1) infinite,
    loading-spinner-rotate 2s linear infinite;
}

@keyframes loading-spinner-rotate {
  from {
    transform: rotate(-90deg);
  }
  to {
    transform: rotate(810deg);
  }
}

@keyframes loading-spinner-dash {
  0% {
    stroke-dasharray: 0% 314.159%;
    stroke-dashoffset: 0%;
  }
  50% {
    stroke-dasharray: 157.080% 157.080%;
    stroke-dashoffset: 0%;
  }
  100% {
    stroke-dasharray: 0% 314.159%;
    stroke-dashoffset: -157.080%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-spinner-circle {
    animation: none;
    stroke-dasharray: 78.54% 235.619%;
    stroke-dashoffset: 0%;
    transform: rotate(-90deg);
  }
}
</style>
