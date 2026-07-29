<template>
  <div class="flex flex-col space-y-4">
    <div v-if="selectedTableId" class="flex justify-end">
      <button
        type="button"
        class="text-xs text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
        @click="emit('exit-selected-table')"
      >
        {{ t("markdown.returnToText") }}
      </button>
    </div>

    <!-- Empty state -->
    <SurfacePanel
      v-if="visibleTables.length === 0"
      class="flex flex-col items-center justify-center px-4 py-10 text-center"
    >
      <IconTile class="mb-3" tone="neutral">
        <AppIcon name="table" :size="6" :stroke-width="1.7" />
      </IconTile>
      <p class="text-sm text-ink-600 dark:text-ink-400 font-medium">
        {{ t("markdown.tableNone") }}
      </p>
      <p class="text-xs text-ink-500 dark:text-ink-400 mt-1 max-w-xs">
        {{ t("markdown.tableNoneHelp") }}
      </p>
      <AppButton
        variant="primary"
        class="mt-4 flex cursor-pointer items-center gap-1.5 px-4 py-2 text-xs animate-none"
        @click="createDefaultTable"
      >
        <AppIcon name="plus" :size="4" :stroke-width="2.5" />
        <span>{{ t("markdown.tableQuickCreate") }}</span>
      </AppButton>
    </SurfacePanel>

    <!-- Table list -->
    <div v-else class="space-y-6">
      <EditorSurface
        v-for="(table, tableIdx) in visibleTables"
        :key="table.id"
        elevated
        class="overflow-hidden"
      >
        <!-- Table header bar -->
        <div
          class="flex justify-between items-center bg-ink-50/50 dark:bg-ink-950/20 px-3 py-2 border-b border-ink-150 dark:border-ink-850"
        >
          <span class="text-xs font-bold text-ink-500 dark:text-ink-400">
            {{
              t("markdown.tableLabel", {
                number: tableIdx + 1,
                rows: table.rows.length + 1,
                columns: table.headers.length,
              })
            }}
          </span>
        </div>

        <!-- Table grid -->
        <div class="scrollbar-subtle overflow-x-auto p-4">
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
                    :aria-label="t('common.columnTitleNumber', { column: colIdx + 1 })"
                    class="w-full text-sm font-bold text-ink-900 dark:text-ink-100 bg-transparent border-0 focus:ring-0 outline-none p-1 text-center"
                    :placeholder="t('common.columnTitle')"
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
                    :aria-label="t('common.cellPosition', { row: rowIdx + 1, column: colIdx + 1 })"
                    class="w-full text-sm text-ink-850 dark:text-ink-200 bg-transparent border-0 focus:ring-0 outline-none p-1"
                    :placeholder="t('common.cellContents')"
                    @input="onCellInput"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </EditorSurface>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue";
import AppButton from "@/components/ui/atoms/AppButton.vue";
import AppIcon from "@/components/ui/atoms/AppIcon.vue";
import IconTile from "@/components/ui/atoms/IconTile.vue";
import SurfacePanel from "@/components/ui/molecules/SurfacePanel.vue";
import EditorSurface from "@/components/ui/molecules/EditorSurface.vue";
import { parseMarkdownTables } from "@/lib/markdown-tables";
import { useI18n } from "@/i18n";

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
const { t } = useI18n();

const emit = defineEmits<{
  "update:content": [content: string];
  "table-inserted": [];
  "exit-selected-table": [];
}>();

const parsedTables = ref<ParsedTable[]>([]);
const isUpdatingFromVisualEditor = ref(false);
const visibleTables = computed(() =>
  props.selectedTableId
    ? parsedTables.value.filter((table) => table.id === props.selectedTableId)
    : parsedTables.value,
);

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
  const escapeCell = (cell: string) => (cell || "").replace(/\|/g, "\\|");
  const headerLine = "| " + headers.map(escapeCell).join(" | ") + " |";
  const dividerLine = "| " + headers.map(() => "---").join(" | ") + " |";
  const bodyLines = rows
    .map((row) => "| " + row.map(escapeCell).join(" | ") + " |")
    .join("\n");
  return headerLine + "\n" + dividerLine + (bodyLines ? "\n" + bodyLines : "");
}

// Rebuild the full markdown content and emit it
function rebuildMarkdown() {
  let newMarkdown = "";
  let lastIndex = 0;
  for (let i = 0; i < parsedTables.value.length; i++) {
    const table = parsedTables.value[i];
    newMarkdown += props.content.substring(lastIndex, table.startIndex);
    newMarkdown += stringifyTable(table.headers, table.rows);
    lastIndex = table.endIndex;
  }
  newMarkdown += props.content.substring(lastIndex);

  isUpdatingFromVisualEditor.value = true;
  emit("update:content", newMarkdown);
  nextTick(() => {
    isUpdatingFromVisualEditor.value = false;
  });
}

function onCellInput() {
  rebuildMarkdown();
}

function createDefaultTable() {
  const headers = Array.from({ length: 3 }, (_, index) =>
    t("markdown.defaultHeader", { number: index + 1 }),
  );
  const cells = Array.from({ length: 6 }, (_, index) =>
    t("markdown.defaultCell", { number: index + 1 }),
  );
  const defaultTableMarkdown = `| ${headers.join(" | ")} |\n| --- | --- | --- |\n| ${cells.slice(0, 3).join(" | ")} |\n| ${cells.slice(3).join(" | ")} |\n`;
  const separator = props.content ? "\n\n" : "";
  const newContent = props.content + separator + defaultTableMarkdown;
  emit("update:content", newContent);
  emit("table-inserted");

  nextTick(() => {
    parseAllTables(props.content);
  });
}

// Watch for external content updates
watch(
  () => props.content,
  (newVal) => {
    if (!isUpdatingFromVisualEditor.value) {
      parseAllTables(newVal);
    }
  },
  { immediate: true },
);
</script>
