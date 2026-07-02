<template>
  <div class="flex flex-col space-y-4">
    <div v-if="selectedTableId" class="flex justify-end">
      <button
        type="button"
        class="text-xs text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
        @click="emit('exit-selected-table')"
      >
        返回文字編輯
      </button>
    </div>

    <!-- Empty state -->
    <div
      v-if="visibleTables.length === 0"
      class="flex flex-col items-center justify-center py-10 px-4 text-center border border-dashed border-ink-200 dark:border-ink-800 rounded-xl bg-white dark:bg-ink-900"
    >
      <span class="text-2xl mb-2">📊</span>
      <p class="text-sm text-ink-600 dark:text-ink-400 font-medium">尚未在內容中偵測到任何表格</p>
      <p class="text-xs text-ink-400 dark:text-ink-500 mt-1 max-w-xs">
        您可以切換回「文字」編輯模式，點擊工具列上的表格按鈕插入表格，或點擊下方按鈕快速新增表格。
      </p>
      <button
        type="button"
        class="button-primary text-xs px-4 py-2 mt-4 flex items-center gap-1.5 rounded-lg cursor-pointer animate-none"
        @click="createDefaultTable"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        <span>建立預設表格 (3x3)</span>
      </button>
    </div>

    <!-- Table list -->
    <div v-else class="space-y-6">
      <div
        v-for="(table, tableIdx) in visibleTables"
        :key="table.id"
        class="border border-ink-200 dark:border-ink-800 rounded-xl overflow-hidden bg-white dark:bg-ink-900 shadow-sm"
      >
        <!-- Table header bar -->
        <div class="flex justify-between items-center bg-ink-50/50 dark:bg-ink-950/20 px-3 py-2 border-b border-ink-150 dark:border-ink-850">
          <span class="text-xs font-bold text-ink-500 dark:text-ink-400">
            表格 {{ tableIdx + 1 }} ({{ table.rows.length + 1 }}x{{ table.headers.length }})
          </span>
        </div>

        <!-- Table grid -->
        <div class="overflow-x-auto p-4 scrollbar-thin">
          <table class="min-w-full border-collapse">
            <thead>
              <!-- Header Row -->
              <tr>
                <th
                  v-for="(header, colIdx) in table.headers"
                  :key="'header-' + colIdx"
                  class="p-1 border border-ink-150 dark:border-ink-800 bg-ink-50/30 dark:bg-ink-950/10 min-w-[120px]"
                >
                  <input
                    v-model="table.headers[colIdx]"
                    class="w-full text-sm font-bold text-ink-900 dark:text-ink-100 bg-transparent border-0 focus:ring-0 outline-none p-1 text-center"
                    placeholder="欄位標題"
                    @input="onCellInput"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              <!-- Data Rows -->
              <tr v-for="(row, rowIdx) in table.rows" :key="'row-' + rowIdx">
                <td
                  v-for="(cell, colIdx) in row"
                  :key="'cell-' + rowIdx + '-' + colIdx"
                  class="p-1 border border-ink-150 dark:border-ink-800 min-w-[120px]"
                >
                  <input
                    v-model="row[colIdx]"
                    class="w-full text-sm text-ink-850 dark:text-ink-200 bg-transparent border-0 focus:ring-0 outline-none p-1"
                    placeholder="儲存格內容"
                    @input="onCellInput"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { parseMarkdownTables } from '@/lib/markdown-tables';

interface ParsedTable {
  id: string;
  startIndex: number;
  endIndex: number;
  headers: string[];
  rows: string[][];
}

const props = defineProps<{
  content: string;
  selectedTableId?: string | null;
}>();

const emit = defineEmits<{
  'update:content': [content: string];
  'table-inserted': [];
  'exit-selected-table': [];
}>();

const parsedTables = ref<ParsedTable[]>([]);
const isUpdatingFromVisualEditor = ref(false);
const visibleTables = computed(() => (
  props.selectedTableId
    ? parsedTables.value.filter((table) => table.id === props.selectedTableId)
    : parsedTables.value
));

function parseAllTables(markdown: string) {
  parsedTables.value = parseMarkdownTables(markdown).map((table, index) => ({
    id: `table-${index}`,
    startIndex: table.start,
    endIndex: table.end,
    headers: [...table.headers],
    rows: table.rows.map((row) => [...row]),
  }));
}

// Convert headers and rows back to markdown table format, escaping pipes
function stringifyTable(headers: string[], rows: string[][]): string {
  const escapeCell = (cell: string) => (cell || '').replace(/\|/g, '\\|');
  const headerLine = '| ' + headers.map(escapeCell).join(' | ') + ' |';
  const dividerLine = '| ' + headers.map(() => '---').join(' | ') + ' |';
  const bodyLines = rows.map(row => '| ' + row.map(escapeCell).join(' | ') + ' |').join('\n');
  return headerLine + '\n' + dividerLine + (bodyLines ? '\n' + bodyLines : '');
}

// Rebuild the full markdown content and emit it
function rebuildMarkdown() {
  let newMarkdown = '';
  let lastIndex = 0;
  for (let i = 0; i < parsedTables.value.length; i++) {
    const table = parsedTables.value[i];
    newMarkdown += props.content.substring(lastIndex, table.startIndex);
    newMarkdown += stringifyTable(table.headers, table.rows);
    lastIndex = table.endIndex;
  }
  newMarkdown += props.content.substring(lastIndex);
  
  isUpdatingFromVisualEditor.value = true;
  emit('update:content', newMarkdown);
  nextTick(() => {
    isUpdatingFromVisualEditor.value = false;
  });
}

function onCellInput() {
  rebuildMarkdown();
}

function createDefaultTable() {
  const defaultTableMarkdown = `| 標題 1 | 標題 2 | 標題 3 |\n| --- | --- | --- |\n| 內容 1 | 內容 2 | 內容 3 |\n| 內容 4 | 內容 5 | 內容 6 |\n`;
  const separator = props.content ? '\n\n' : '';
  const newContent = props.content + separator + defaultTableMarkdown;
  emit('update:content', newContent);
  emit('table-inserted');
  
  nextTick(() => {
    parseAllTables(props.content);
  });
}

// Watch for external content updates
watch(() => props.content, (newVal) => {
  if (!isUpdatingFromVisualEditor.value) {
    parseAllTables(newVal);
  }
}, { immediate: true });
</script>
