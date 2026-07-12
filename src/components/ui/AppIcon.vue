<template>
  <component
    :is="iconComponent"
    class="text-current"
    :class="sizeClass"
    :stroke-width="strokeWidth"
    :fill="filled ? 'currentColor' : 'none'"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue';
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  Code2,
  Download,
  FileClock,
  Heading1,
  Heading2,
  Heart,
  Image,
  Inbox,
  Info,
  Link,
  List,
  ListOrdered,
  Lock,
  Megaphone,
  MessageCircle,
  Minus,
  MoreHorizontal,
  Pencil,
  Plus,
  Quote,
  RefreshCw,
  Reply,
  RotateCcw,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Table,
  ThumbsUp,
  Trash2,
  User,
  X,
} from '@lucide/vue';

export type AppIconName =
  | 'bell' | 'chart' | 'changelog' | 'check-circle' | 'chevron-down'
  | 'chevron-left' | 'chevron-right' | 'circle-alert' | 'circle-help' | 'close'
  | 'comment' | 'edit' | 'heart' | 'image' | 'inbox' | 'info' | 'download'
  | 'link' | 'lock' | 'megaphone' | 'more-horizontal' | 'refresh' | 'restart'
  | 'reply' | 'search' | 'send' | 'settings' | 'share' | 'shield-check' | 'sort'
  | 'switch-horizontal' | 'thumbs-up' | 'trash' | 'user' | 'warning'
  | 'h1' | 'h2' | 'list' | 'numlist' | 'plus' | 'quote' | 'code'
  | 'divider' | 'table';

const props = withDefaults(defineProps<{
  detail?: boolean;
  filled?: boolean;
  name: AppIconName;
  size?: number;
  strokeWidth?: number;
}>(), {
  detail: false,
  filled: false,
  size: 4,
  strokeWidth: 2,
});

const iconComponents: Record<AppIconName, Component> = {
  bell: Bell,
  chart: BarChart3,
  changelog: FileClock,
  'check-circle': CheckCircle2,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'circle-alert': CircleAlert,
  'circle-help': CircleHelp,
  close: X,
  comment: MessageCircle,
  edit: Pencil,
  heart: Heart,
  image: Image,
  inbox: Inbox,
  info: Info,
  download: Download,
  link: Link,
  lock: Lock,
  megaphone: Megaphone,
  'more-horizontal': MoreHorizontal,
  refresh: RefreshCw,
  restart: RotateCcw,
  reply: Reply,
  search: Search,
  send: Send,
  settings: Settings,
  share: Share2,
  'shield-check': ShieldCheck,
  sort: SlidersHorizontal,
  'switch-horizontal': ArrowLeftRight,
  'thumbs-up': ThumbsUp,
  trash: Trash2,
  user: User,
  warning: CircleAlert,
  h1: Heading1,
  h2: Heading2,
  list: List,
  numlist: ListOrdered,
  plus: Plus,
  quote: Quote,
  code: Code2,
  divider: Minus,
  table: Table,
};

const sizeMap: Record<number, string> = {
  3: 'h-3 w-3',
  3.5: 'h-3.5 w-3.5',
  4: 'h-4 w-4',
  4.5: 'h-4.5 w-4.5',
  5: 'h-5 w-5',
  6: 'h-6 w-6',
  8: 'h-8 w-8',
  10: 'h-10 w-10',
};

const iconComponent = computed(() => iconComponents[props.name]);
const sizeClass = computed(() => sizeMap[props.size] ?? 'h-4 w-4');
</script>
