<template>
  <UserAvatar
    :photo-url="resolvedPhotoUrl"
    :name="name"
    :size="size"
    :alt-text="altText"
  />
</template>

<script setup lang="ts">
import UserAvatar from '@/components/ui/UserAvatar.vue';
import { useAuthorAvatarUrl } from '@/composables/useAuthorAvatar';

const props = withDefaults(defineProps<{
  altText?: string;
  authorUid?: string | null;
  name: string;
  photoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
}>(), {
  altText: '使用者頭像',
  authorUid: null,
  photoUrl: null,
  size: 'md',
});

const resolvedPhotoUrl = useAuthorAvatarUrl(
  () => props.authorUid,
  () => props.photoUrl,
);
</script>
