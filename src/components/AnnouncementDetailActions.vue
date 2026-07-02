<template>
  <div class="mt-auto flex shrink-0 flex-wrap items-center gap-2 border-t border-ink-100 pt-3 dark:border-ink-800">
    <DetailActionButton
      :active="announcement.currentUserLiked"
      :disabled="liking"
      :label="announcement.currentUserLiked ? `已讚 ${announcement.like_count}` : `讚 ${announcement.like_count}`"
      :title="announcement.currentUserLiked ? '取消讚' : '讚'"
      :aria-label="announcement.currentUserLiked ? '取消讚' : '讚'"
      @click="emit('toggleLike')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" :fill="announcement.currentUserLiked ? 'currentColor' : 'none'" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733C11.285 4.876 9.623 3.75 7.688 3.75 5.099 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
      </svg>
    </DetailActionButton>

    <DetailActionButton
      label="分享"
      title="複製分享連結"
      aria-label="複製分享連結"
      @click="emit('share')"
    >
      <ShareIcon :size="4" />
    </DetailActionButton>

    <DetailActionButton
      v-if="canManage"
      label="編輯"
      title="編輯公告"
      aria-label="編輯公告"
      @click="emit('edit')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
      </svg>
    </DetailActionButton>

    <DetailActionButton
      v-if="canManage"
      danger
      label="刪除"
      title="刪除公告"
      aria-label="刪除公告"
      @click="emit('delete')"
    >
      <TrashIcon :size="4" />
    </DetailActionButton>
  </div>
</template>

<script setup lang="ts">
import DetailActionButton from '@/components/ui/DetailActionButton.vue';
import ShareIcon from '@/components/ui/ShareIcon.vue';
import TrashIcon from '@/components/ui/TrashIcon.vue';
import type { AnnouncementRecord } from '@/types';

defineProps<{
  announcement: AnnouncementRecord;
  canManage: boolean;
  liking: boolean;
}>();

const emit = defineEmits<{
  delete: [];
  edit: [];
  share: [];
  toggleLike: [];
}>();
</script>
