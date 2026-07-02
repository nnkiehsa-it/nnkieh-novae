<template>
  <div class="absolute top-1.5 left-1/2 -translate-x-1/2 md:left-[180px] md:translate-x-0 z-[120] rounded-xl border border-ink-200 bg-white p-3 shadow-lg dark:border-ink-800 dark:bg-ink-900 w-44 shrink-0 select-none">
    <p class="text-[10px] font-bold text-ink-400 dark:text-ink-500 mb-2 text-center whitespace-nowrap">
      {{ hoveredRow >= 0 ? `建立 ${hoveredRow + 1} x ${hoveredCol + 1} 表格` : '選取表格大小' }}
    </p>
    <div class="grid grid-cols-5 gap-1.5" @mouseleave="resetTableHover">
      <div
        v-for="r in 5"
        :key="`row-${r}`"
        class="contents"
      >
        <div
          v-for="c in 5"
          :key="`col-${c}`"
          class="w-6 h-6 rounded border cursor-pointer transition-colors duration-150"
          :class="isCellSelected(r - 1, c - 1) ? 'bg-ink-900 border-ink-900 dark:bg-ink-100 dark:border-ink-100' : 'border-ink-200 dark:border-ink-700 bg-ink-50/50 hover:bg-ink-100 dark:bg-ink-950/50'"
          @mouseenter="hoverCell(r - 1, c - 1)"
          @click="selectCell(r, c)"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{
  'select': [rows: number, cols: number];
}>();

const hoveredRow = ref(-1);
const hoveredCol = ref(-1);

function hoverCell(r: number, c: number) {
  hoveredRow.value = r;
  hoveredCol.value = c;
}

function resetTableHover() {
  hoveredRow.value = -1;
  hoveredCol.value = -1;
}

function isCellSelected(r: number, c: number) {
  if (hoveredRow.value === -1 || hoveredCol.value === -1) return false;
  return r <= hoveredRow.value && c <= hoveredCol.value;
}

function selectCell(r: number, c: number) {
  emit('select', r, c);
}
</script>
