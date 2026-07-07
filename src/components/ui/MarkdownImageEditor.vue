<template>
  <div ref="editorRootRef" class="relative flex flex-col min-h-0 h-full space-y-2">
    <!-- Header row with label and tabs/image action -->
    <div class="flex items-center justify-between gap-3 shrink-0">
      <label :for="textareaId" class="field-label">{{ label }}</label>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          autocomplete="off"
          class="hidden"
          multiple
          @change="emit('image-picked', $event)"
        >
        
        <!-- Tab switchers (hidden on desktop if split screen is active) -->
        <template v-if="!split">
          <button
            type="button"
            :class="['button-toolbar', { 'button-toolbar--active': !showPreview }]"
            @click="emit('update:showPreview', false)"
          >
            編輯
          </button>
          <button
            type="button"
            :class="['button-toolbar', { 'button-toolbar--active': showPreview }]"
            @click="emit('update:showPreview', true)"
          >
            預覽
          </button>
        </template>
        <!-- On mobile, show switcher tabs even if split is true -->
        <template v-else>
          <button
            type="button"
            :class="['button-toolbar md:hidden', { 'button-toolbar--active': !showPreview }]"
            @click="emit('update:showPreview', false)"
          >
            編輯
          </button>
          <button
            type="button"
            :class="['button-toolbar md:hidden', { 'button-toolbar--active': showPreview }]"
            @click="emit('update:showPreview', true)"
          >
            預覽
          </button>
        </template>
      </div>
    </div>

    <!-- Layout container (Split screen desktop vs single column responsive fallback) -->
    <div v-if="split" class="hidden md:grid grid-cols-2 gap-6 flex-1 min-h-0 h-full relative">
      <!-- Left Column: Rich Text Area -->
      <div class="flex flex-col min-h-0 border border-ink-200 dark:border-ink-800 rounded-xl bg-white dark:bg-ink-900 overflow-hidden relative">
        <!-- Formatting Toolbar -->
        <MarkdownToolbar
          @command="executeToolbarCommand"
        >
          <div class="h-4 w-px bg-ink-200 dark:bg-ink-700 mx-1 shrink-0"></div>
          <button
            type="button"
            class="button-toolbar shrink-0"
            :disabled="disabled || uploading || images.length >= maxImages"
            :title="uploading ? '圖片處理中...' : images.length >= maxImages ? `${maxImagesLabel}最多 ${maxImages} 張圖片` : '加入圖片'"
            aria-label="插入圖片"
            @click="fileInputRef?.click()"
          >
            <AppIcon name="image" />
          </button>
          <span v-if="uploading" class="text-xs text-ink-400 select-none shrink-0 ml-1">{{ busyLabel }}</span>
          <span v-else class="text-xs text-ink-400 select-none shrink-0 ml-1">{{ images.length }} / {{ maxImages }}</span>
        </MarkdownToolbar>

        <!-- Textarea input wrapper (relative so popover escapes toolbar overflow-x-auto) -->
        <div class="flex-1 min-h-0 relative flex flex-col">
          <!-- Image upload previews -->
          <MarkdownImagePreviews
            :images="images"
            @remove-image="emit('remove-image', $event)"
          />
          <div
            v-if="activeMode === 'table'"
            class="flex items-center justify-between px-3 py-1 bg-ink-50/30 dark:bg-ink-950/10 border-b border-ink-100 dark:border-ink-850 text-[11px] text-ink-500 shrink-0 select-none"
          >
            <span>表格編輯</span>
            <button
              type="button"
              class="px-2 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1 text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800/40"
              @click="exitTableMode"
            >
              <AppIcon name="edit" :size="3" />
              <span>返回文字編輯</span>
            </button>
          </div>
          <div
            v-if="activeMode === 'text'"
            class="flex-1 overflow-y-auto p-3 space-y-3"
          >
            <template v-for="(block, index) in textModeBlocks" :key="block.id">
              <textarea
                v-if="block.type === 'text'"
                :id="index === 0 ? textareaId : undefined"
                :ref="(el) => setTextareaRef(block.id, el as HTMLTextAreaElement | null)"
                :value="block.content"
                :class="textBlockTextareaClass"
                class="w-full resize-none bg-transparent text-base text-ink-800 outline-none focus:ring-0 dark:text-ink-100 md:text-sm"
                autocomplete="off"
                :maxlength="maxLength"
                :placeholder="placeholder"
                :disabled="disabled || uploading"
                @focus="handleTextBlockFocus(block.id)"
                @input="onTextBlockInput(block.id, $event)"
                @keydown="onTextareaKeyDown"
                @compositionstart="handleCompositionStart"
                @compositionend="handleCompositionEnd(block.id, $event)"
                @select="handleTextareaCursorChange(block.id)"
                @click="handleTextareaCursorChange(block.id)"
                @keyup="handleTextareaCursorChange(block.id)"
              ></textarea>
              <div
                v-else
                class="rounded-lg border border-ink-200 bg-ink-50/70 px-3 py-2 dark:border-ink-700 dark:bg-ink-900/60"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-ink-800 dark:text-ink-100">表格區塊</p>
                    <p class="text-xs text-ink-500 dark:text-ink-400">
                      {{ block.table.rows.length + 1 }} x {{ block.table.headers.length }}
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="text-xs text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-ink-50"
                      @click="switchToTableMode(block.id)"
                    >
                      編輯表格
                    </button>
                    <button
                      type="button"
                      class="text-xs text-error hover:opacity-80"
                      @click="deleteTableBlockFromCard(block.id)"
                    >
                      刪除
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </div>
          <VisualTableEditor
            v-else
            :content="localContent"
            :selected-table-id="selectedTableId"
            class="flex-1 min-h-[180px] overflow-y-auto p-3"
            @update:content="localContent = $event"
            @exit-selected-table="exitTableMode"
          />

          <!-- Visual Table Picker (escapes toolbar clipping container) -->
          <TableGridPicker
            v-if="showTablePicker"
            ref="tablePickerRef"
            @select="createTable"
          />
        </div>
      </div>

      <!-- Right Column: Split Live Preview -->
      <div class="flex flex-col min-h-0 border border-ink-200 dark:border-ink-800 rounded-xl bg-white dark:bg-ink-900 p-4 overflow-y-auto">
        <h3 class="text-xs font-bold text-ink-400 dark:text-ink-500 mb-3 uppercase tracking-wider shrink-0">即時渲染預覽</h3>
        <div class="flex-1 min-h-0">
          <MarkdownRenderer v-if="previewContent.trim()" :content="previewContent" />
          <span v-else class="text-sm italic text-ink-400">沒有可預覽的內容</span>
        </div>
      </div>
    </div>

    <!-- Mobile or fallback Single Column Layout -->
    <div
      v-else-if="!showPreview"
      class="field min-h-56 p-0 overflow-hidden flex flex-col flex-1 relative"
      :class="editorClass"
    >
      <!-- Formatting Toolbar -->
      <MarkdownToolbar
        @command="executeToolbarCommand"
      >
        <div class="h-4 w-px bg-ink-200 dark:bg-ink-700 mx-1 shrink-0"></div>
        <button
          type="button"
          class="button-toolbar shrink-0"
          :disabled="disabled || uploading || images.length >= maxImages"
          :title="uploading ? '圖片處理中...' : images.length >= maxImages ? `${maxImagesLabel}最多 ${maxImages} 張圖片` : '加入圖片'"
          aria-label="插入圖片"
          @click="fileInputRef?.click()"
        >
          <AppIcon name="image" />
        </button>
        <span v-if="uploading" class="text-xs text-ink-400 select-none shrink-0 ml-1">{{ busyLabel }}</span>
        <span v-else class="text-xs text-ink-400 select-none shrink-0 ml-1">{{ images.length }} / {{ maxImages }}</span>
      </MarkdownToolbar>

      <!-- Image previews & Textarea Container -->
      <div class="flex-1 min-h-0 relative flex flex-col">
        <!-- Image previews -->
        <MarkdownImagePreviews
          :images="images"
          size="lg"
          @remove-image="emit('remove-image', $event)"
        />
        <div
          v-if="activeMode === 'table'"
          class="flex items-center justify-between px-3 py-1 bg-ink-50/30 dark:bg-ink-950/10 border-b border-ink-100 dark:border-ink-850 text-[11px] text-ink-500 shrink-0 select-none"
        >
          <span>表格編輯</span>
          <button
            type="button"
            class="px-2 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1 text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800/40"
            @click="exitTableMode"
          >
            <AppIcon name="edit" :size="3" />
            <span>返回文字編輯</span>
          </button>
        </div>
        <div
          v-if="activeMode === 'text'"
          class="min-h-56 w-full border-none bg-transparent p-3 flex-1 overflow-y-auto space-y-3"
        >
          <template v-for="(block, index) in textModeBlocks" :key="block.id">
            <textarea
              v-if="block.type === 'text'"
              :id="index === 0 ? textareaId : undefined"
              :ref="(el) => setTextareaRef(block.id, el as HTMLTextAreaElement | null)"
              :value="block.content"
              :class="textBlockTextareaClass"
              class="w-full resize-none border-none bg-transparent text-base text-ink-800 outline-none focus:ring-0 dark:text-ink-100 md:text-sm"
              autocomplete="off"
              :maxlength="maxLength"
              :placeholder="placeholder"
              :disabled="disabled || uploading"
              @focus="handleTextBlockFocus(block.id)"
              @input="onTextBlockInput(block.id, $event)"
              @keydown="onTextareaKeyDown"
              @compositionstart="handleCompositionStart"
              @compositionend="handleCompositionEnd(block.id, $event)"
              @select="handleTextareaCursorChange(block.id)"
              @click="handleTextareaCursorChange(block.id)"
              @keyup="handleTextareaCursorChange(block.id)"
            ></textarea>
            <div
              v-else
              class="rounded-lg border border-ink-200 bg-ink-50/70 px-3 py-2 dark:border-ink-700 dark:bg-ink-900/60"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-ink-800 dark:text-ink-100">表格區塊</p>
                  <p class="text-xs text-ink-500 dark:text-ink-400">
                    {{ block.table.rows.length + 1 }} x {{ block.table.headers.length }}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="text-xs text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-ink-50"
                    @click="switchToTableMode(block.id)"
                  >
                    編輯表格
                  </button>
                  <button
                    type="button"
                    class="text-xs text-error hover:opacity-80"
                    @click="deleteTableBlockFromCard(block.id)"
                  >
                    刪除
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>
        <VisualTableEditor
          v-else
          :content="localContent"
          :selected-table-id="selectedTableId"
          class="flex-1 min-h-[180px] overflow-y-auto p-3"
          @update:content="localContent = $event"
          @exit-selected-table="exitTableMode"
        />

        <!-- Visual Table Picker -->
        <TableGridPicker
          v-if="showTablePicker"
          ref="tablePickerRef"
          @select="createTable"
        />
      </div>
    </div>

    <!-- Mobile or fallback Single Column Preview -->
    <div
      v-else
      class="field min-h-56 max-h-[500px] overflow-y-auto border border-ink-200 bg-white font-sans dark:border-ink-700 dark:bg-ink-900 flex-1"
      :class="previewClass"
    >
      <MarkdownRenderer v-if="previewContent.trim()" :content="previewContent" />
      <span v-else class="text-sm italic text-ink-400">沒有可預覽的內容</span>
    </div>

    <!-- Responsive Fallback layout for split screen mobile view -->
    <div
      v-if="split"
      class="md:hidden flex flex-col flex-1 min-h-0"
    >
      <div
        v-if="!showPreview"
        class="field min-h-56 p-0 overflow-hidden flex flex-col flex-1 relative"
        :class="editorClass"
      >
        <!-- Formatting Toolbar -->
        <MarkdownToolbar
          @command="executeToolbarCommand"
        >
          <div class="h-4 w-px bg-ink-200 dark:bg-ink-700 mx-1 shrink-0"></div>
          <button
            type="button"
            class="button-toolbar shrink-0"
            :disabled="disabled || uploading || images.length >= maxImages"
            :title="uploading ? '圖片處理中...' : images.length >= maxImages ? `${maxImagesLabel}最多 ${maxImages} 張圖片` : '加入圖片'"
            aria-label="插入圖片"
            @click="fileInputRef?.click()"
          >
            <AppIcon name="image" />
          </button>
          <span v-if="uploading" class="text-xs text-ink-400 select-none shrink-0 ml-1">{{ busyLabel }}</span>
          <span v-else class="text-xs text-ink-400 select-none shrink-0 ml-1">{{ images.length }} / {{ maxImages }}</span>
        </MarkdownToolbar>

        <!-- Textarea input container -->
        <div class="flex-1 min-h-0 relative flex flex-col">
          <!-- Image upload previews -->
          <MarkdownImagePreviews
            :images="images"
            @remove-image="emit('remove-image', $event)"
          />
          <div
            v-if="activeMode === 'table'"
            class="flex items-center justify-between px-3 py-1 bg-ink-50/30 dark:bg-ink-950/10 border-b border-ink-100 dark:border-ink-850 text-[11px] text-ink-500 shrink-0 select-none"
          >
            <span>表格編輯</span>
            <button
              type="button"
              class="px-2 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1 text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800/40"
              @click="exitTableMode"
            >
              <AppIcon name="edit" :size="3" />
              <span>返回文字編輯</span>
            </button>
          </div>
          <div
            v-if="activeMode === 'text'"
            class="flex-1 overflow-y-auto p-3 space-y-3"
          >
            <template v-for="(block, index) in textModeBlocks" :key="block.id">
              <textarea
                v-if="block.type === 'text'"
                :id="index === 0 ? textareaId : undefined"
                :ref="(el) => setTextareaRef(block.id, el as HTMLTextAreaElement | null)"
                :value="block.content"
                :class="textBlockTextareaClass"
                class="w-full resize-none bg-transparent text-base text-ink-800 outline-none focus:ring-0 dark:text-ink-100 md:text-sm"
                autocomplete="off"
                :maxlength="maxLength"
                :placeholder="placeholder"
                :disabled="disabled || uploading"
                @focus="handleTextBlockFocus(block.id)"
                @input="onTextBlockInput(block.id, $event)"
                @keydown="onTextareaKeyDown"
                @compositionstart="handleCompositionStart"
                @compositionend="handleCompositionEnd(block.id, $event)"
                @select="handleTextareaCursorChange(block.id)"
                @click="handleTextareaCursorChange(block.id)"
                @keyup="handleTextareaCursorChange(block.id)"
              ></textarea>
              <div
                v-else
                class="rounded-lg border border-ink-200 bg-ink-50/70 px-3 py-2 dark:border-ink-700 dark:bg-ink-900/60"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-ink-800 dark:text-ink-100">表格區塊</p>
                    <p class="text-xs text-ink-500 dark:text-ink-400">
                      {{ block.table.rows.length + 1 }} x {{ block.table.headers.length }}
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="text-xs text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-ink-50"
                      @click="switchToTableMode(block.id)"
                    >
                      編輯表格
                    </button>
                    <button
                      type="button"
                      class="text-xs text-error hover:opacity-80"
                      @click="deleteTableBlockFromCard(block.id)"
                    >
                      刪除
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </div>
          <VisualTableEditor
            v-else
            :content="localContent"
            :selected-table-id="selectedTableId"
            class="flex-1 min-h-[180px] overflow-y-auto p-3"
            @update:content="localContent = $event"
            @exit-selected-table="exitTableMode"
          />

          <!-- Visual Table Picker -->
          <TableGridPicker
            v-if="showTablePicker"
            ref="tablePickerRef"
            @select="createTable"
          />
        </div>
      </div>

      <div
        v-else
        class="field min-h-56 max-h-[500px] overflow-y-auto border border-ink-200 bg-white font-sans dark:border-ink-700 dark:bg-ink-900 flex-1"
        :class="previewClass"
      >
        <MarkdownRenderer v-if="previewContent.trim()" :content="previewContent" />
        <span v-else class="text-sm italic text-ink-400">沒有可預覽的內容</span>
      </div>
    </div>

    <!-- Bottom counter/helper text row -->
    <div class="flex justify-between text-xs text-ink-500 dark:text-ink-400 shrink-0">
      <span>{{ effectiveHelperText }}</span>
      <span class="font-medium" :class="{ 'text-error': content.length > warningLength }">
        {{ content.length }} / {{ maxLength }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from 'vue';
import MarkdownRenderer from '@/components/MarkdownRenderer.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import VisualTableEditor from './VisualTableEditor.vue';
import MarkdownToolbar from './MarkdownToolbar.vue';
import MarkdownImagePreviews from './MarkdownImagePreviews.vue';
import TableGridPicker from './TableGridPicker.vue';
import {
  hasMarkdownTables,
  splitMarkdownTextTableBlocks,
} from '@/lib/markdown-tables';
import {
  type MarkdownEditorCommandId,
} from '@/lib/markdown-editor-commands';

export interface MarkdownEditorImage {
  alt: string;
  key: string;
  src: string;
}

const DEFAULT_HELPER_TEXT = '可輸入文字或加入圖片，使用工具列插入格式';

const props = withDefaults(defineProps<{
  busyLabel?: string;
  content: string;
  disabled?: boolean;
  editorClass?: string;
  helperText?: string;
  images: MarkdownEditorImage[];
  label: string;
  maxImages: number;
  maxImagesLabel?: string;
  maxLength: number;
  placeholder?: string;
  previewClass?: string;
  previewContent: string;
  showPreview: boolean;
  textareaClass?: string;
  textareaId: string;
  uploading?: boolean;
  warningLength: number;
  split?: boolean;
}>(), {
  busyLabel: '圖片處理中...',
  disabled: false,
  editorClass: '',
  helperText: DEFAULT_HELPER_TEXT,
  maxImagesLabel: '',
  placeholder: '',
  previewClass: '',
  textareaClass: '',
  uploading: false,
  split: false,
});

const emit = defineEmits<{
  'image-picked': [event: Event];
  'remove-image': [key: string];
  'update:content': [content: string];
  'update:showPreview': [showPreview: boolean];
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);
const editorRootRef = ref<HTMLDivElement | null>(null);
const slashMenuRef = ref<HTMLDivElement | null>(null);
const tablePickerRef = ref<any>(null);
const localContent = ref(props.content);
const textareaRefs = ref<Record<string, HTMLTextAreaElement | null>>({});
const textSelections = ref<Record<string, { start: number; end: number }>>({});
const activeTextBlockId = ref<string | null>(null);
const selectedTableId = ref<string | null>(null);

const activeMode = ref<'text' | 'table'>('text');
const TEXTAREA_MAX_HEIGHT = 220;
const SLASH_MENU_WIDTH = 256;
const VIEWPORT_PADDING = 12;
const SLASH_MENU_CARET_GAP = 20;

const hasTables = computed(() => hasMarkdownTables(localContent.value));
const textModeBlocks = computed(() => splitMarkdownTextTableBlocks(localContent.value));

watch(hasTables, (newVal) => {
  if (!newVal && activeMode.value === 'table') {
    activeMode.value = 'text';
  }
});

watch(() => props.content, (newVal) => {
  if (newVal !== localContent.value) {
    localContent.value = newVal;
  }
}, { immediate: true });

watch(localContent, (newVal) => {
  if (newVal !== props.content) {
    emit('update:content', newVal);
  }
});

watch(textModeBlocks, (blocks) => {
  const hasActive = activeTextBlockId.value
    && blocks.some((block) => block.type === 'text' && block.id === activeTextBlockId.value);
  if (hasActive) return;

  const firstTextBlock = blocks.find((block) => block.type === 'text');
  activeTextBlockId.value = firstTextBlock?.type === 'text' ? firstTextBlock.id : null;
}, { immediate: true });

watch(textModeBlocks, (blocks) => {
  if (selectedTableId.value && !blocks.some((block) => block.type === 'table' && block.id === selectedTableId.value)) {
    selectedTableId.value = null;
    activeMode.value = 'text';
  }

  nextTick(() => {
    Object.values(textareaRefs.value).forEach((textarea) => {
      if (textarea) {
        resizeTextarea(textarea);
      }
    });
  });
}, { deep: true });

// Slash command states
const isComposingText = ref(false);

// Table Grid Picker states
const showTablePicker = ref(false);

const activeTextarea = computed(() => {
  const currentId = activeTextBlockId.value;
  if (currentId && textareaRefs.value[currentId]) {
    return textareaRefs.value[currentId];
  }

  const firstTextBlock = textModeBlocks.value.find((block) => block.type === 'text');
  return firstTextBlock ? textareaRefs.value[firstTextBlock.id] ?? null : null;
});

const effectiveHelperText = computed(() => props.helperText);

const textBlockTextareaClass = computed(() => (hasTables.value ? 'min-h-[1.75rem]' : props.textareaClass));

function setTextareaRef(id: string, el: HTMLTextAreaElement | null) {
  textareaRefs.value[id] = el;
  if (el) {
    resizeTextarea(el);
  }
}

function getTextBlockIndex(id: string) {
  return textModeBlocks.value.findIndex((block) => block.id === id && block.type === 'text');
}

function rebuildContent(updatedTextBlocks: Record<string, string>, removedTableId?: string) {
  const parts: string[] = [];
  const blocks = textModeBlocks.value.filter((block) => !(block.type === 'table' && block.id === removedTableId));

  blocks.forEach((block, index) => {
    if (block.type === 'text') {
      const content = updatedTextBlocks[block.id] ?? block.content;
      if (content.length > 0) {
        parts.push(content);
      }
      return;
    }

    if (parts.length > 0 && parts[parts.length - 1] !== '\n\n') {
      parts.push('\n\n');
    }
    parts.push(block.table.raw);
    if (index < blocks.length - 1) {
      parts.push('\n\n');
    }
  });

  return parts.join('').replace(/\n{3,}/gu, '\n\n');
}

function focusTextBlock(id: string, cursorPosition?: number) {
  nextTick(() => {
    const textarea = textareaRefs.value[id];
    if (!textarea) return;
    resizeTextarea(textarea);
    textarea.focus();
    if (typeof cursorPosition === 'number') {
      textarea.setSelectionRange(cursorPosition, cursorPosition);
    }
  });
}

function resizeTextarea(textarea: HTMLTextAreaElement) {
  if (!hasTables.value) {
    textarea.style.height = '100%';
    textarea.style.overflowY = 'auto';
    return;
  }

  textarea.style.height = 'auto';
  const minHeight = 28;
  const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), TEXTAREA_MAX_HEIGHT);
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = textarea.scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
}

function getActiveSelection(blockId: string, fallbackTextLength = 0) {
  const textarea = textareaRefs.value[blockId];
  if (textarea) {
    return {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };
  }

  return textSelections.value[blockId] ?? {
    start: fallbackTextLength,
    end: fallbackTextLength,
  };
}

function rememberTextareaSelection(blockId: string, textarea: HTMLTextAreaElement) {
  textSelections.value[blockId] = {
    start: textarea.selectionStart,
    end: textarea.selectionEnd,
  };
}

function insertAtCursor(textToInsert: string, cursorOffsetAfterInsert = 0, isBlock = false) {
  const blockId = activeTextBlockId.value;
  if (!blockId) return;

  const textBlock = textModeBlocks.value.find((block) => block.id === blockId && block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') return;
  const currentVal = textBlock.content;
  const { start, end } = getActiveSelection(blockId, currentVal.length);

  const insertStartIdx = start;
  let prefix = '';
  if (isBlock && insertStartIdx > 0 && currentVal[insertStartIdx - 1] !== '\n') {
    prefix = '\n';
  }

  const beforeText = currentVal.substring(0, insertStartIdx);
  const afterText = currentVal.substring(end);

  const finalInsertText = prefix + textToInsert;
  localContent.value = rebuildContent({ [blockId]: beforeText + finalInsertText + afterText });

  const newCursorPos = insertStartIdx + finalInsertText.length - cursorOffsetAfterInsert;
  focusTextBlock(blockId, newCursorPos);
}

function runMarkdownCommand(commandId: MarkdownEditorCommandId) {
  if (commandId === 'h1') {
    insertAtCursor('# ', 0, true);
    return;
  }

  if (commandId === 'h2') {
    insertAtCursor('## ', 0, true);
    return;
  }

  if (commandId === 'list') {
    insertAtCursor('- ', 0, true);
    return;
  }

  if (commandId === 'numlist') {
    insertAtCursor('1. ', 0, true);
    return;
  }

  if (commandId === 'quote') {
    insertAtCursor('> ', 0, true);
    return;
  }

  if (commandId === 'code') {
    insertAtCursor('```\n\n```', 4, true);
    return;
  }

  if (commandId === 'divider') {
    insertAtCursor('---\n', 0, true);
    return;
  }

  insertAtCursor('', 0, false);
  showTablePicker.value = true;
}

function executeToolbarCommand(commandId: MarkdownEditorCommandId) {
  runMarkdownCommand(commandId);
}

function onTextBlockInput(blockId: string, e: Event) {
  const target = e.target as HTMLTextAreaElement;
  activeTextBlockId.value = blockId;
  resizeTextarea(target);
  localContent.value = rebuildContent({ [blockId]: target.value });
  rememberTextareaSelection(blockId, target);

  if (isComposingText.value) {
    return;
  }

  nextTick(() => {
    rememberTextareaSelection(blockId, target);
  });
}

function handleCompositionStart() {
  isComposingText.value = true;
}

function handleCompositionEnd(blockId: string, e: CompositionEvent) {
  isComposingText.value = false;
  onTextBlockInput(blockId, e);
}

function handleListEnter(e: KeyboardEvent, blockId: string, textarea: HTMLTextAreaElement): boolean {
  if (e.key !== 'Enter' || textarea.selectionStart !== textarea.selectionEnd) {
    return false;
  }

  const currentVal = textarea.value;
  const cursor = textarea.selectionStart;
  const lineStart = currentVal.lastIndexOf('\n', cursor - 1) + 1;
  const lineEndIndex = currentVal.indexOf('\n', cursor);
  const lineEnd = lineEndIndex === -1 ? currentVal.length : lineEndIndex;
  const currentLine = currentVal.slice(lineStart, lineEnd);
  const unorderedMatch = currentLine.match(/^(\s*)-\s(.*)$/u);
  const orderedMatch = currentLine.match(/^(\s*)(\d{1,3})\.\s(.*)$/u);

  if (!unorderedMatch && !orderedMatch) {
    return false;
  }

  e.preventDefault();

  const contentMatch = unorderedMatch ?? orderedMatch;
  if (!contentMatch) return false;

  const itemContent = contentMatch[orderedMatch ? 3 : 2] ?? '';
  if (itemContent.trim().length === 0) {
    const newVal = currentVal.slice(0, lineStart) + currentVal.slice(lineEnd);
    localContent.value = rebuildContent({ [blockId]: newVal });
    focusTextBlock(blockId, lineStart);
    return true;
  }

  const nextMarker = orderedMatch
    ? `${orderedMatch[1]}${Number(orderedMatch[2]) + 1}. `
    : `${unorderedMatch?.[1] ?? ''}- `;
  const insertText = `\n${nextMarker}`;
  const newVal = currentVal.slice(0, cursor) + insertText + currentVal.slice(cursor);
  localContent.value = rebuildContent({ [blockId]: newVal });
  focusTextBlock(blockId, cursor + insertText.length);
  return true;
}

function onTextareaKeyDown(e: KeyboardEvent) {
  const textarea = e.target instanceof HTMLTextAreaElement ? e.target : activeTextarea.value;
  const blockId = activeTextBlockId.value;
  if (!textarea || !blockId) return;

  if (activeMode.value === 'text' && handleTableBlockDeletion(e, blockId, textarea)) {
    return;
  }

  if (handleListEnter(e, blockId, textarea)) return;
  if (e.key === 'Backspace' || e.key === 'Delete') return;
}

function deleteTableBlock(tableId: string, focusBlockId?: string, cursorPosition = 0) {
  localContent.value = rebuildContent({}, tableId);
  if (focusBlockId) {
    activeTextBlockId.value = focusBlockId;
    focusTextBlock(focusBlockId, cursorPosition);
  }
}

function handleTableBlockDeletion(e: KeyboardEvent, blockId: string, textarea: HTMLTextAreaElement): boolean {
  const blockIndex = getTextBlockIndex(blockId);
  if (blockIndex === -1) return false;

  const blocks = textModeBlocks.value;
  const currentBlock = blocks[blockIndex];
  if (!currentBlock || currentBlock.type !== 'text') return false;

  if (e.key === 'Backspace' && textarea.selectionStart === 0 && textarea.selectionEnd === 0) {
    const previousBlock = blocks[blockIndex - 1];
    if (previousBlock?.type !== 'table') return false;
    e.preventDefault();
    deleteTableBlock(previousBlock.id, blockId, 0);
    return true;
  }

  if (e.key === 'Delete' && textarea.selectionStart === currentBlock.content.length && textarea.selectionEnd === currentBlock.content.length) {
    const nextBlock = blocks[blockIndex + 1];
    if (nextBlock?.type !== 'table') return false;
    e.preventDefault();
    deleteTableBlock(nextBlock.id, blockId, currentBlock.content.length);
    return true;
  }

  return false;
}

// Table Grid Picker logic
function toggleTablePicker() {
  showTablePicker.value = !showTablePicker.value;
}

function insertTableBlock(markdownTable: string) {
  const blockId = activeTextBlockId.value;
  if (!blockId) return;

  const textBlock = textModeBlocks.value.find((block) => block.id === blockId && block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') return;
  const currentVal = textBlock.content;
  const { start, end } = getActiveSelection(blockId, currentVal.length);
  const needsLeadingBreak = start > 0 && currentVal[start - 1] !== '\n';
  const trailingBreak = end >= currentVal.length
    ? '\n\n'
    : currentVal[end] === '\n'
      ? (currentVal[end + 1] === '\n' ? '' : '\n')
      : '\n\n';
  const insertText = `${needsLeadingBreak ? '\n' : ''}${markdownTable}${trailingBreak}`;

  localContent.value = rebuildContent({
    [blockId]: currentVal.slice(0, start) + insertText + currentVal.slice(end),
  });

  focusTextBlock(blockId, start + insertText.length);
}

function createTable(rows: number, cols: number) {
  let headerRow = '|';
  let alignRow = '|';
  for (let c = 0; c < cols; c++) {
    headerRow += ` 標題 ${c + 1} |`;
    alignRow += ' --- |';
  }
  
  let bodyRows = '';
  for (let r = 0; r < rows - 1; r++) {
    let rowText = '|';
    for (let c = 0; c < cols; c++) {
      rowText += ' 內容 |';
    }
    bodyRows += '\n' + rowText;
  }

  const markdownTable = `${headerRow}\n${alignRow}${bodyRows}`;
  insertTableBlock(markdownTable);
  showTablePicker.value = false;
}

function handleTextareaCursorChange(blockId: string) {
  activeTextBlockId.value = blockId;
  const textarea = textareaRefs.value[blockId];
  if (textarea) {
    rememberTextareaSelection(blockId, textarea);
  }
}

function handleTextBlockFocus(blockId: string) {
  activeTextBlockId.value = blockId;
  const textarea = textareaRefs.value[blockId];
  if (textarea) {
    rememberTextareaSelection(blockId, textarea);
  }
}

function deleteTableBlockFromCard(tableId: string) {
  const blocks = textModeBlocks.value;
  const tableIndex = blocks.findIndex((block) => block.id === tableId);
  if (tableIndex === -1) return;

  const previousTextBlock = blocks.slice(0, tableIndex).reverse().find((block) => block.type === 'text');
  const nextTextBlock = blocks.slice(tableIndex + 1).find((block) => block.type === 'text');
  const focusBlock = previousTextBlock ?? nextTextBlock;
  const focusPosition = previousTextBlock?.type === 'text'
    ? previousTextBlock.content.length
    : 0;

  deleteTableBlock(tableId, focusBlock?.type === 'text' ? focusBlock.id : undefined, focusPosition);
}

function switchToTableMode(tableId: string) {
  selectedTableId.value = tableId;
  activeMode.value = 'table';
}

function exitTableMode() {
  activeMode.value = 'text';
  selectedTableId.value = null;
}

function handleDocumentClick(e: MouseEvent) {
  if (showTablePicker.value) {
    const tablePicker = tablePickerRef.value?.$el || tablePickerRef.value;
    const triggerButtons = document.querySelectorAll('.table-btn-trigger');
    let clickedTrigger = false;
    triggerButtons.forEach(btn => {
      if (btn.contains(e.target as Node)) {
        clickedTrigger = true;
      }
    });
    
    if (tablePicker && !tablePicker.contains(e.target as Node) && !clickedTrigger) {
      showTablePicker.value = false;
    }
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick);
});
</script>

<style scoped>
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
