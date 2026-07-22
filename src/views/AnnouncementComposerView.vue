<template>
  <RoutePageFrame as="section" bleed layout="fill" class="entry-composer-page">
    <AnnouncementComposer
      @close="returnToList"
      @submitted="openSubmittedAnnouncement"
    />
  </RoutePageFrame>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import AnnouncementComposer from '@/components/AnnouncementComposer.vue';
import RoutePageFrame from '@/components/ui/organisms/RoutePageFrame.vue';
import type { AnnouncementRecord } from '@/types';

const router = useRouter();

function returnToList() {
  void router.replace({ name: 'announcements' });
}

function openSubmittedAnnouncement(announcement: AnnouncementRecord) {
  void router.replace({
    name: 'announcement-detail',
    params: { announcementId: announcement.id },
  });
}
</script>
