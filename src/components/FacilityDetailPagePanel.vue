<template>
  <ContentDetailPagePanel
    :author-uid="facility.author_uid"
    back-label="facility.backToFacilityList"
    :content="facility.content"
    :context-content="facility.location"
    context-title="facility.place"
    context-tone="neutral"
    details-label="facility.facilityDetails"
    :notice-content="facility.result_content"
    :notice-fallback-alt="t('facility.resultImage', { title: facility.title })"
    notice-title="issue.result"
    notice-markdown
    :show-comments="false"
    show-mobile-comments
    :title="facility.title"
    @back="emit('back')"
  >
    <template #header>
      <TagBadge class="border-ink-200 bg-ink-100/50 dark:border-ink-800 dark:bg-ink-950/50">
        {{ categoryLabel }}
      </TagBadge>
      <TagBadge elevated class="font-semibold" :class="statusClass">{{ statusLabel }}</TagBadge>
    </template>

    <template #actions="{ compact }">
      <FacilityDetailActions
        :affecting="affecting"
        :closed="closed"
        :compact="compact"
        :facility="facility"
        :next-status-action-label="nextStatusActionLabel"
        :operation-time-items="operationTimeItems"
        @delete="emit('delete')"
        @manage-status="emit('manageStatus')"
        @share="emit('share')"
        @toggle-affected="emit('toggleAffected')"
      />
    </template>

    <template #comments="{ embedded }">
      <UnavailableCommentDiscussion
        :mobile-docked="embedded"
      />
    </template>
  </ContentDetailPagePanel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import FacilityDetailActions from '@/components/FacilityDetailActions.vue';
import ContentDetailPagePanel from '@/components/ContentDetailPagePanel.vue';
import UnavailableCommentDiscussion from '@/components/UnavailableCommentDiscussion.vue';
import TagBadge from '@/components/ui/atoms/TagBadge.vue';
import type { FacilityRecord, OperationTimeListItem } from '@/types';
import { useI18n } from '@/i18n';
import { findFacilityCategory } from '@/composables/useCategories';

const { t } = useI18n();

const props = defineProps<{
  affecting: boolean;
  closed: boolean;
  facility: FacilityRecord;
  nextStatusActionLabel: string;
  operationTimeItems: OperationTimeListItem[];
  statusClass: string;
  statusLabel: string;
}>();

const emit = defineEmits<{
  back: [];
  delete: [];
  manageStatus: [];
  share: [];
  toggleAffected: [];
}>();

const categoryLabel = computed(() => findFacilityCategory(props.facility.category_id)?.label ?? props.facility.category_id);
</script>
