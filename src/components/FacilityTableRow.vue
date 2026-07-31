<template>
  <ContentCardShell
    :author-uid="facility.author_uid"
    :highlight-query="highlightQuery"
    :status-class="statusClass"
    :status-label="statusLabel"
    :time-label="formatDate(facility.created_at)"
    :title="facility.title"
    @open="emit('open-details', facility)"
  >
    <template #supplement>
      <ContentNoticePanel compact class="mt-4">
        <span class="text-ink-500 dark:text-ink-400">{{ facility.location }}</span>
        <template #trailing>
          <span class="font-semibold tabular-nums text-ink-700 dark:text-ink-300">{{ t('facility.affectedCount', { count: facility.affected_count }) }}</span>
        </template>
      </ContentNoticePanel>
    </template>

    <template #actions>
      <AppButton
        :variant="facility.currentUserAffected ? 'icon-pill-filled' : 'icon-pill'"
        class="button-card-count"
        :disabled="affecting || facility.isOwnFacility || isClosed"
        :title="t(facility.isOwnFacility ? 'facility.authorIncludedInAffectedCount' : 'facility.iAlsoEncountered')"
        @click="emit('toggle-affected', facility)"
      >
        <AppIcon name="hand" :size="4" />
        <span>{{ facility.affected_count }}</span>
      </AppButton>
    </template>
  </ContentCardShell>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import ContentCardShell from '@/components/ui/organisms/ContentCardShell.vue';
import ContentNoticePanel from '@/components/ui/molecules/ContentNoticePanel.vue';
import { useStatusStyling } from '@/composables/useStatusStyling';
import { FACILITY_STATUS_LABELS, isFacilityClosed } from '@/constants/statuses';
import { formatDate } from '@/lib/format';
import type { FacilitySummary } from '@/types';
import { useI18n } from '@/i18n';

const props = withDefaults(defineProps<{
  affecting?: boolean;
  facility: FacilitySummary;
  highlightQuery?: string;
}>(), {
  affecting: false,
  highlightQuery: '',
});
const emit = defineEmits<{
  'open-details': [facility: FacilitySummary];
  'toggle-affected': [facility: FacilitySummary];
}>();
const { t } = useI18n();
const status = computed(() => props.facility.status);
const statusLabel = computed(() => t(FACILITY_STATUS_LABELS[status.value]));
const isClosed = computed(() => isFacilityClosed(status.value));
const { statusClass } = useStatusStyling(toRef(props.facility, 'status'), 'table-row');
</script>
