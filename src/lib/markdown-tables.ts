export interface MarkdownTableBlock {
  start: number;
  end: number;
  raw: string;
  headers: string[];
  rows: string[][];
}

export type MarkdownTextTableBlock =
  | {
    id: string;
    type: 'text';
    content: string;
  }
  | {
    id: string;
    type: 'table';
    table: MarkdownTableBlock;
  };

interface LineInfo {
  text: string;
  start: number;
  end: number;
}

function getLinesInfo(markdown: string): LineInfo[] {
  const lines = markdown.split('\n');
  const linesInfo: LineInfo[] = [];
  let currentOffset = 0;

  for (const text of lines) {
    const start = currentOffset;
    const end = currentOffset + text.length;
    linesInfo.push({ text, start, end });
    currentOffset = end + 1;
  }

  return linesInfo;
}

function hasUnescapedPipe(text: string): boolean {
  return /(?<!\\)\|/u.test(text);
}

function isDividerCell(cell: string): boolean {
  return /^:?-{3,}:?$/u.test(cell.trim());
}

function isDividerLine(text: string): boolean {
  if (!hasUnescapedPipe(text)) return false;
  const cells = parseMarkdownTableRowCells(text);
  return cells.length >= 2 && cells.every(isDividerCell);
}

function isTableRow(text: string): boolean {
  return hasUnescapedPipe(text) && parseMarkdownTableRowCells(text).length >= 2;
}

export function parseMarkdownTableRowCells(lineText: string): string[] {
  let trimmed = lineText.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.substring(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.substring(0, trimmed.length - 1);

  return trimmed
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

export function parseMarkdownTables(markdown: string): MarkdownTableBlock[] {
  if (!markdown) return [];

  const linesInfo = getLinesInfo(markdown);
  const tables: MarkdownTableBlock[] = [];

  let index = 0;
  while (index < linesInfo.length - 1) {
    const currentLine = linesInfo[index];
    const nextLine = linesInfo[index + 1];

    if (!isTableRow(currentLine.text) || !isDividerLine(nextLine.text)) {
      index += 1;
      continue;
    }

    const headers = parseMarkdownTableRowCells(currentLine.text);
    const dividerCells = parseMarkdownTableRowCells(nextLine.text);
    const columnCount = headers.length;
    if (columnCount < 2 || dividerCells.length !== columnCount) {
      index += 1;
      continue;
    }

    const rows: string[][] = [];
    let tableEndLineIndex = index + 1;
    let rowIndex = index + 2;

    while (rowIndex < linesInfo.length && isTableRow(linesInfo[rowIndex].text) && !isDividerLine(linesInfo[rowIndex].text)) {
      const rowCells = parseMarkdownTableRowCells(linesInfo[rowIndex].text);
      while (rowCells.length < columnCount) rowCells.push('');
      if (rowCells.length > columnCount) rowCells.splice(columnCount);
      rows.push(rowCells);
      tableEndLineIndex = rowIndex;
      rowIndex += 1;
    }

    tables.push({
      start: linesInfo[index].start,
      end: linesInfo[tableEndLineIndex].end,
      raw: markdown.slice(linesInfo[index].start, linesInfo[tableEndLineIndex].end),
      headers,
      rows,
    });

    index = tableEndLineIndex + 1;
  }

  return tables;
}

export function hasMarkdownTables(markdown: string): boolean {
  return parseMarkdownTables(markdown).length > 0;
}

export function findMarkdownTableAtPosition(markdown: string, position: number): MarkdownTableBlock | null {
  const tables = parseMarkdownTables(markdown);
  return tables.find((table) => position >= table.start && position <= table.end) ?? null;
}

export function selectionIntersectsMarkdownTable(
  markdown: string,
  start: number,
  end: number,
): MarkdownTableBlock | null {
  const tables = parseMarkdownTables(markdown);
  return tables.find((table) => start < table.end && end > table.start) ?? null;
}

export function splitMarkdownTextTableBlocks(markdown: string): MarkdownTextTableBlock[] {
  const tables = parseMarkdownTables(markdown);
  if (tables.length === 0) {
    return [{ id: 'text-0', type: 'text', content: markdown }];
  }

  const blocks: MarkdownTextTableBlock[] = [];
  let cursor = 0;
  let textIndex = 0;

  tables.forEach((table, index) => {
    if (cursor < table.start) {
      let textContent = markdown.slice(cursor, table.start);
      if (blocks.length > 0) {
        textContent = textContent.replace(/^\n{1,2}/u, '');
      }
      textContent = textContent.replace(/\n+$/u, '');
      if (textContent.length > 0 || blocks.length === 0) {
        blocks.push({
          id: `text-${textIndex}`,
          type: 'text',
          content: textContent,
        });
        textIndex += 1;
      }
    }

    blocks.push({
      id: `table-${index}`,
      type: 'table',
      table,
    });

    cursor = table.end;
    if (markdown[cursor] === '\n' && markdown[cursor + 1] === '\n') {
      cursor += 2;
    } else if (markdown[cursor] === '\n') {
      cursor += 1;
    }

    if (index === tables.length - 1 && cursor <= markdown.length) {
      const trailingText = markdown.slice(cursor).replace(/^\n{1,2}/u, '');
      blocks.push({
        id: `text-${textIndex}`,
        type: 'text',
        content: trailingText,
      });
    }
  });

  return blocks.length > 0 ? blocks : [{ id: 'text-0', type: 'text', content: markdown }];
}

export function normalizeMarkdownTableSpacing(
  markdown: string,
  cursorPosition?: number,
): { content: string; cursorPosition: number | undefined } {
  const tables = parseMarkdownTables(markdown);
  if (tables.length === 0) {
    return { content: markdown, cursorPosition };
  }

  let content = markdown;
  let nextCursor = cursorPosition;

  for (let index = tables.length - 1; index >= 0; index -= 1) {
    const table = tables[index];
    const suffix = content.slice(table.end);
    const decision = suffix.length === 0
      ? { insertAt: table.end, insertText: '\n\n' }
      : suffix.startsWith('\n\n')
        ? null
        : suffix.startsWith('\n')
          ? { insertAt: table.end + 1, insertText: '\n' }
          : { insertAt: table.end, insertText: '\n\n' };

    if (!decision) {
      continue;
    }

    content = content.slice(0, decision.insertAt) + decision.insertText + content.slice(decision.insertAt);
    if (typeof nextCursor === 'number' && nextCursor >= decision.insertAt) {
      nextCursor += decision.insertText.length;
    }
  }

  return { content, cursorPosition: nextCursor };
}
