<template>
  <div
    class="relative"
    :class="{ 'z-50': isDropdownOpen }"
  >
    <!-- Mobile view (condensed card/row format, hidden on md) -->
    <div class="issue-row-mobile md:hidden">
      <div class="flex min-w-0 items-center gap-2 w-full">
        <span class="tag shrink-0 px-2 py-0.5 text-xs border-ink-200 bg-ink-100/50 text-ink-700 dark:border-ink-800 dark:bg-ink-950/50">
          公告
        </span>
        <AuthorAvatar :author-uid="announcement.author_uid" :photo-url="announcement.author_photo_url" :name="announcement.author_name" size="sm" :alt-text="`${announcement.author_name} 的頭像`" class="shrink-0" />
        <button
          class="text-trigger -my-1 flex min-h-10 flex-1 items-center text-left"
          type="button"
          @click.stop="emit('open', announcement)"
        >
          <span class="line-clamp-1 font-semibold text-sm tracking-normal text-ink-950 dark:text-ink-50 hover:underline">
            {{ announcement.title }}
          </span>
        </button>
      </div>
      <div class="mt-1.5 flex w-full items-center gap-2">
        <div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-xs text-ink-500 dark:text-ink-400">
          <span class="min-w-0 truncate font-normal text-ink-400 dark:text-ink-500">{{ dateLabel }}</span>
        </div>
        <div class="flex shrink-0 items-center justify-end gap-1.5">
          <!-- Likes button -->
          <button
            type="button"
            class="button-toolbar h-10 w-10 rounded-full p-0 flex items-center justify-center"
            :class="announcement.currentUserLiked ? 'text-red-600 dark:text-red-300' : ''"
            :disabled="liking"
            @click.stop="emit('toggleLike', announcement)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" :fill="announcement.currentUserLiked ? 'currentColor' : 'none'" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733C11.285 4.876 9.623 3.75 7.688 3.75 5.099 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
            <span class="text-xs ml-1 font-medium">{{ announcement.like_count }}</span>
          </button>

          <!-- comments button -->
          <button
            type="button"
            class="button-toolbar h-10 w-10 rounded-full p-0 flex items-center justify-center"
            title="查看留言"
            aria-label="查看留言"
            @click.stop="emit('openComments', announcement)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" />
            </svg>
            <span class="text-xs ml-1 font-medium">{{ announcement.comment_count }}</span>
          </button>

          <CompactActionMenu
            v-if="canManage"
            class="shrink-0"
            title="管理公告"
            @dropdown-open="(open) => isDropdownOpen = open"
            @delete="emit('delete', announcement)"
            @edit="emit('edit', announcement)"
          />
        </div>
      </div>
    </div>

    <!-- Desktop view (md:grid, hidden on mobile) -->
    <div
      class="issue-table-row hidden md:grid"
      :style="{ 'grid-template-columns': tableCols }"
      role="row"
    >
      <div class="flex items-center w-24 shrink-0">
        <span class="tag border-ink-200 bg-ink-100/50 dark:border-ink-800 dark:bg-ink-950/50">
          公告
        </span>
      </div>

      <div class="flex items-center gap-2 w-32 shrink-0 pr-2">
        <AuthorAvatar
          :author-uid="announcement.author_uid"
          :photo-url="announcement.author_photo_url"
          :name="announcement.author_name"
          size="sm"
          :alt-text="`${announcement.author_name} 的頭像`"
          class="author-avatar"
        />
        <span class="truncate text-xs font-normal text-ink-500 dark:text-ink-400" :title="announcement.author_name">
          {{ announcement.author_name }}
        </span>
      </div>

      <div class="flex items-center gap-2 flex-1 min-w-0 pr-3">
        <button
          type="button"
          class="text-trigger w-full py-1 text-left text-sm font-semibold tracking-tight text-ink-900 hover:text-ink-950 hover:underline dark:text-ink-100 dark:hover:text-white sm:text-base truncate"
          :title="announcement.title"
          @click="emit('open', announcement)"
        >
          {{ announcement.title }}
        </button>
      </div>

      <div class="flex items-center w-32 shrink-0 text-xs text-ink-400/90 dark:text-ink-500/90 whitespace-nowrap">
        {{ dateLabel }}
      </div>

      <div class="flex items-center gap-1 w-36 shrink-0 pr-2">
        <!-- Likes button -->
        <button
          type="button"
          class="button-toolbar h-7 px-2 rounded-full flex items-center justify-center"
          :class="announcement.currentUserLiked ? 'text-red-600 dark:text-red-300' : ''"
          :disabled="liking"
          @click.stop="emit('toggleLike', announcement)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" :fill="announcement.currentUserLiked ? 'currentColor' : 'none'" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733C11.285 4.876 9.623 3.75 7.688 3.75 5.099 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
          </svg>
          <span class="text-xs ml-1 font-semibold">{{ announcement.like_count }}</span>
        </button>

        <!-- Comments button -->
        <button
          type="button"
          class="button-toolbar h-7 px-2 rounded-full flex items-center justify-center"
          title="查看留言"
          aria-label="查看留言"
          @click="emit('openComments', announcement)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" />
          </svg>
          <span class="text-xs ml-1 font-semibold">{{ announcement.comment_count }}</span>
        </button>
      </div>

      <div v-if="canManage" class="flex items-center w-10 shrink-0">
        <CompactActionMenu
          title="管理公告"
          @dropdown-open="(open) => isDropdownOpen = open"
          @delete="emit('delete', announcement)"
          @edit="emit('edit', announcement)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { AnnouncementRecord } from '@/types';
import AuthorAvatar from '@/components/AuthorAvatar.vue';
import CompactActionMenu from '@/components/CompactActionMenu.vue';
import { formatDateOnly } from '@/lib/format';

const props = defineProps<{
  announcement: AnnouncementRecord;
  canManage?: boolean;
  liking?: boolean;
}>();

const emit = defineEmits<{
  delete: [announcement: AnnouncementRecord];
  edit: [announcement: AnnouncementRecord];
  open: [announcement: AnnouncementRecord];
  openComments: [announcement: AnnouncementRecord];
  toggleLike: [announcement: AnnouncementRecord];
}>();

const isDropdownOpen = ref(false);

const dateLabel = computed(() => formatDateOnly(props.announcement.published_at));

const tableCols = computed(() => {
  const cols = ['6rem', '8rem', '1fr', '8rem', '9rem'];
  if (props.canManage) cols.push('2.5rem');
  return cols.join(' ');
});
</script>
