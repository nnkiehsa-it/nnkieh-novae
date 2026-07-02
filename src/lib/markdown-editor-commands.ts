import type { AppIconName } from '@/components/ui/AppIcon.vue';

export type MarkdownEditorCommandId =
  | 'h1'
  | 'h2'
  | 'list'
  | 'numlist'
  | 'quote'
  | 'code'
  | 'table'
  | 'divider';

export interface MarkdownEditorCommand {
  id: MarkdownEditorCommandId;
  title: string;
  subtitle: string;
  iconName: AppIconName;
  keywords: string[];
  toolbarTitle: string;
}

export const MARKDOWN_EDITOR_COMMANDS: MarkdownEditorCommand[] = [
  {
    id: 'h1',
    title: '大標題 (H1)',
    subtitle: '最醒目的標題樣式',
    iconName: 'h1',
    keywords: ['h1', 'title', '1', 'header', 'heading', 'da', 'biaoti'],
    toolbarTitle: '大標題 (H1)',
  },
  {
    id: 'h2',
    title: '中標題 (H2)',
    subtitle: '章節與子標題樣式',
    iconName: 'h2',
    keywords: ['h2', 'title', '2', 'header', 'heading', 'zhong', 'biaoti'],
    toolbarTitle: '中標題 (H2)',
  },
  {
    id: 'list',
    title: '項目清單',
    subtitle: '無順序的項目清單',
    iconName: 'list',
    keywords: ['list', 'bullet', 'unordered', 'ul', 'xiangmu', 'qingdan'],
    toolbarTitle: '項目清單',
  },
  {
    id: 'numlist',
    title: '編號清單',
    subtitle: '有順序的清單項目',
    iconName: 'numlist',
    keywords: ['numlist', 'number', 'ordered', 'ol', 'ordered list', 'bianhao', 'qingdan'],
    toolbarTitle: '編號清單',
  },
  {
    id: 'quote',
    title: '引用區塊',
    subtitle: '標註重點引言',
    iconName: 'quote',
    keywords: ['quote', 'blockquote', 'yinyong', 'qukuai'],
    toolbarTitle: '引言區塊',
  },
  {
    id: 'code',
    title: '程式碼區塊',
    subtitle: '插入一段程式碼',
    iconName: 'code',
    keywords: ['code', 'codeblock', 'pre', 'programmer', 'chengshuma', 'qukuai'],
    toolbarTitle: '程式碼區塊',
  },
  {
    id: 'table',
    title: '插入表格',
    subtitle: '建立一個新的資料表格',
    iconName: 'table',
    keywords: ['table', 'grid', 'excel', 'charu', 'biaoge'],
    toolbarTitle: '插入表格',
  },
  {
    id: 'divider',
    title: '水平線 (Divider)',
    subtitle: '插入水平分割線',
    iconName: 'divider',
    keywords: ['divider', 'hr', 'line', 'split', 'shuipingxian', 'fengexian'],
    toolbarTitle: '水平線',
  },
];

export function filterMarkdownEditorCommands(query: string) {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return MARKDOWN_EDITOR_COMMANDS;

  return MARKDOWN_EDITOR_COMMANDS.filter((command) => (
    command.title.toLowerCase().includes(normalizedQuery)
    || command.subtitle.toLowerCase().includes(normalizedQuery)
    || command.id.toLowerCase().includes(normalizedQuery)
    || command.keywords.some((keyword) => keyword.toLowerCase().includes(normalizedQuery))
  ));
}
