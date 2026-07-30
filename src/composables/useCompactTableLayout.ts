import { useResizeObserver } from '@vueuse/core';
import { ref } from 'vue';

const COMPACT_TABLE_MAX_WIDTH = 74 * 16;

export function useCompactTableLayout() {
  const tableRef = ref<HTMLElement | null>(null);
  const isCompactLayout = ref(true);

  function updateLayout(width: number) {
    isCompactLayout.value = width <= COMPACT_TABLE_MAX_WIDTH;
  }

  useResizeObserver(tableRef, (entries) => {
    const entry = entries[0];
    if (entry) updateLayout(entry.contentRect.width);
  });

  return {
    isCompactLayout,
    tableRef,
  };
}
