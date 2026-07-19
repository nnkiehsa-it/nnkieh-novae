<template>
  <ContentCardShell
    :author-name="facility.author_name"
    :author-photo-url="facility.author_photo_url"
    :author-uid="facility.author_uid"
    :highlight-query="highlightQuery"
    :status-class="statusClass"
    :status-label="statusLabel"
    :time-label="formatDate(facility.created_at)"
    :title="facility.title"
    @open="emit('open-details', facility)"
  >
    <template v-if="facility.canManageFacility" #admin>
      <FacilityAdminMenu
        :facility="facility"
        @status="emit('manage-status', facility)"
        @delete="emit('delete', facility)"
      />
    </template>

    <template #supplement>
      <SurfacePanel variant="inset" class="mt-4 px-3 py-2.5">
        <div class="flex items-center justify-between gap-3 text-xs">
          <span class="truncate text-ink-500 dark:text-ink-400">{{ categoryLabel }} · {{ facility.location }}</span>
          <span class="shrink-0 font-semibold tabular-nums text-ink-700 dark:text-ink-300">{{ t('facility.affectedCount', { count: facility.affected_count }) }}</span>
        </div>
      </SurfacePanel>
    </template>

    <template #actions>
      <AppButton
        :variant="facility.currentUserAffected ? 'icon-pill-filled' : 'icon-pill'"
        class="!h-8 !gap-1 !px-2.5 text-xs"
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
import FacilityAdminMenu from '@/components/FacilityAdminMenu.vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import ContentCardShell from '@/components/ui/organisms/ContentCardShell.vue';
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';
import { useStatusStyling } from '@/composables/useStatusStyling';
import { FACILITY_STATUS_LABELS, isFacilityClosed } from '@/constants/statuses';
import { formatDate } from '@/lib/format';
import type { FacilitySummary } from '@/types';
import { useI18n } from '@/i18n';
import { findFacilityCategory } from '@/composables/useCategories';

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
  'manage-status': [facility: FacilitySummary];
  delete: [facility: FacilitySummary];
}>();
const { t } = useI18n();
const status = computed(() => props.facility.status);
const statusLabel = computed(() => t(FACILITY_STATUS_LABELS[status.value]));
const isClosed = computed(() => isFacilityClosed(status.value));
const categoryLabel = computed(() => findFacilityCategory(props.facility.category_id)?.label ?? props.facility.category_id);
const { statusClass } = useStatusStyling(toRef(props.facility, 'status'), 'table-row');
</script>
