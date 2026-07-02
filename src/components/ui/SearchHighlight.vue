<template>
  <span>
    <template v-for="(part, index) in parts" :key="`${index}-${part.text}`">
      <mark
        v-if="part.highlight"
        class="rounded bg-warning-container px-0.5 text-inherit"
      >
        {{ part.text }}
      </mark>
      <template v-else>{{ part.text }}</template>
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { normalizeSearchText } from '@/lib/search';

const props = defineProps<{
  text: string;
  query: string;
}>();

interface HighlightPart {
  text: string;
  highlight: boolean;
}

const parts = computed<HighlightPart[]>(() => {
  const normalizedQuery = normalizeSearchText(props.query);
  if (!normalizedQuery) {
    return [{ text: props.text, highlight: false }];
  }

  const chars = Array.from(props.text);
  const spans: Array<{ start: number; end: number }> = [];
  let normalizedText = '';

  chars.forEach((char) => {
    const start = normalizedText.length;
    normalizedText += char.normalize('NFKC').toLocaleLowerCase();
    spans.push({ start, end: normalizedText.length });
  });

  const nextParts: HighlightPart[] = [];
  let charCursor = 0;
  let normalizedCursor = 0;

  while (normalizedCursor < normalizedText.length) {
    const matchStart = normalizedText.indexOf(normalizedQuery, normalizedCursor);
    if (matchStart === -1) {
      break;
    }

    const matchEnd = matchStart + normalizedQuery.length;
    const charStart = spans.findIndex((span) => span.end > matchStart);
    const charEnd = spans.findIndex((span) => span.start >= matchEnd);
    const safeCharStart = charStart === -1 ? charCursor : charStart;
    const safeCharEnd = charEnd === -1 ? chars.length : charEnd;

    if (safeCharStart > charCursor) {
      nextParts.push({
        text: chars.slice(charCursor, safeCharStart).join(''),
        highlight: false,
      });
    }

    nextParts.push({
      text: chars.slice(safeCharStart, safeCharEnd).join(''),
      highlight: true,
    });

    charCursor = safeCharEnd;
    normalizedCursor = spans[safeCharEnd - 1]?.end ?? matchEnd;
  }

  if (charCursor < chars.length) {
    nextParts.push({
      text: chars.slice(charCursor).join(''),
      highlight: false,
    });
  }

  return nextParts.length > 0 ? nextParts : [{ text: props.text, highlight: false }];
});
</script>
