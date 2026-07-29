import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from 'vue';
import {
  hasMarkdownTables,
  splitMarkdownTextTableBlocks,
} from '@/lib/markdown-tables';
import {
  type MarkdownEditorCommandId,
} from '@/lib/markdown-editor-commands';
import { useI18n } from '@/i18n';

export interface MarkdownEditorImage {
  alt: string;
  key: string;
  src: string;
}

export interface MarkdownImageEditorProps {
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
}

export interface MarkdownImageEditorEmit {
  (e: 'image-picked', event: Event): void;
  (e: 'remove-image', key: string): void;
  (e: 'update:content', content: string): void;
  (e: 'update:showPreview', showPreview: boolean): void;
}

type TablePickerElement = HTMLElement | { $el?: HTMLElement };

const DEFAULT_HELPER_TEXT = 'markdown.editorHelp';

export function useMarkdownImageEditor(
  props: MarkdownImageEditorProps,
  emit: MarkdownImageEditorEmit,
) {
  const { t } = useI18n();
  const fileInputRef = ref<HTMLInputElement | null>(null);
  const editorRootRef = ref<HTMLDivElement | null>(null);
  const tablePickerRef = ref<TablePickerElement | null>(null);
  const localContent = ref(props.content);
  const textareaRefs = ref<Record<string, HTMLTextAreaElement | null>>({});
  const textSelections = ref<Record<string, { start: number; end: number }>>({});
  const activeTextBlockId = ref<string | null>(null);
  const selectedTableId = ref<string | null>(null);
  const labelId = computed(() => `${props.textareaId}-label`);

  const activeMode = ref<'text' | 'table'>('text');
  const TEXTAREA_MAX_HEIGHT = 220;

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

  // IME Composition states
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

  const effectiveHelperText = computed(() => props.helperText ?? DEFAULT_HELPER_TEXT);

  const textBlockTextareaClass = computed(() => (hasTables.value ? 'min-h-[1.75rem]' : props.textareaClass));

  function textareaDomId(area: 'desktop' | 'mobile' | 'single', index: number) {
    if (index !== 0) return undefined;
    return `${props.textareaId}-${area}`;
  }

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
      headerRow += ` ${t('markdown.defaultHeader', { number: c + 1 })} |`;
      alignRow += ' --- |';
    }

    let bodyRows = '';
    for (let r = 0; r < rows - 1; r++) {
      let rowText = '|';
      for (let c = 0; c < cols; c++) {
        rowText += ` ${t('markdown.defaultCell', { number: c + 1 })} |`;
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
      const pickerRef = tablePickerRef.value;
      const tablePicker = pickerRef instanceof HTMLElement ? pickerRef : pickerRef?.$el;
      const triggerButtons = document.querySelectorAll('.table-btn-trigger');
      let clickedTrigger = false;
      triggerButtons.forEach((btn) => {
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

  return {
    fileInputRef,
    editorRootRef,
    tablePickerRef,
    localContent,
    labelId,
    activeMode,
    hasTables,
    textModeBlocks,
    selectedTableId,
    showTablePicker,
    effectiveHelperText,
    textBlockTextareaClass,
    textareaDomId,
    setTextareaRef,
    executeToolbarCommand,
    onTextBlockInput,
    handleCompositionStart,
    handleCompositionEnd,
    onTextareaKeyDown,
    createTable,
    handleTextareaCursorChange,
    handleTextBlockFocus,
    deleteTableBlockFromCard,
    switchToTableMode,
    exitTableMode,
  };
}
