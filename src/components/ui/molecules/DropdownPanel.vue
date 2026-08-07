<template>
  <div class="dropdown-panel" :class="sizeClass" @keydown="cycleItemFocus">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  size?: 'compact' | 'default' | 'search';
}>(), {
  size: 'default',
});

const sizeClass = computed(() => ({
  compact: 'w-44',
  default: 'min-w-44',
  search: 'w-80 max-w-[calc(100vw-2rem)] p-3.5',
})[props.size]);

function cycleItemFocus(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
  const panel = event.currentTarget;
  if (!(panel instanceof HTMLElement)) return;
  const items = Array.from(panel.querySelectorAll<HTMLElement>(
    'button:not(:disabled), a[href], [role="menuitem"]:not([aria-disabled="true"]), [role="option"]:not([aria-disabled="true"])',
  )).filter((item) => item.getClientRects().length > 0);
  if (!items.length) return;

  event.preventDefault();
  const currentIndex = items.indexOf(document.activeElement as HTMLElement);
  const nextIndex = event.key === 'ArrowDown'
    ? (currentIndex + 1 + items.length) % items.length
    : (currentIndex - 1 + items.length) % items.length;
  items[nextIndex].focus();
}
</script>
