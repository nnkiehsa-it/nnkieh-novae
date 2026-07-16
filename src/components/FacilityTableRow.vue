<template>
  <div class="relative" role="listitem">
    <article class="issue-card list-row-trigger relative overflow-hidden" data-list-row-trigger @click="emit('open-details', facility)">
      <header class="flex min-w-0 items-center gap-2">
        <span class="tag-sm shrink-0 font-semibold" :class="statusClass">{{ statusLabel }}</span>
        <span class="ml-auto truncate text-xs text-ink-400 dark:text-ink-500">{{ formatDate(facility.created_at) }}</span>
        <div v-if="facility.canManageFacility" class="shrink-0" @click.stop>
          <FacilityAdminMenu
            :facility="facility"
            @status="emit('manage-status', facility)"
            @delete="emit('delete', facility)"
          />
        </div>
      </header>

      <div class="mt-3 flex min-w-0 items-center gap-2.5">
        <UserAvatar
          :photo-url="facility.author_photo_url"
          :name="facility.author_name"
          size="sm"
          :alt-text="`${facility.author_name} 的頭像`"
          class="shrink-0"
        />
        <div class="min-w-0 flex-1">
          <h3 class="line-clamp-2 text-[15px] font-semibold leading-6 tracking-[0.01em] text-ink-950 dark:text-ink-50 sm:text-base">
            <SearchHighlight :text="facility.title" :query="highlightQuery" />
          </h3>
          <p class="mt-0.5 truncate text-xs text-ink-500 dark:text-ink-400">{{ facility.author_name }}</p>
        </div>
      </div>

      <div class="mt-4 rounded-xl bg-ink-50/85 px-3 py-2.5 dark:bg-ink-900/55">
        <div class="flex items-center justify-between gap-3 text-xs">
          <span class="truncate text-ink-500 dark:text-ink-400">{{ facility.location }}</span>
          <span class="shrink-0 font-semibold tabular-nums text-ink-700 dark:text-ink-300">{{ facility.affected_count }} 人遇到</span>
        </div>
      </div>

      <footer class="mt-3 flex items-center justify-end gap-1.5" @click.stop>
        <button
          type="button"
          :class="[
            facility.currentUserAffected ? 'button-icon-pill-filled' : 'button-icon-pill',
            '!h-8 !gap-1 !px-2.5 text-xs',
          ]"
          :disabled="affecting || facility.isOwnFacility || isClosed"
          :title="facility.isOwnFacility ? '作者已自動計入' : '我也遇到'"
          @click="emit('toggle-affected', facility)"
        >
          <AppIcon name="hand" :size="4" />
          <span>{{ facility.affected_count }}</span>
        </button>
      </footer>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue';
import FacilityAdminMenu from '@/components/FacilityAdminMenu.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import SearchHighlight from '@/components/ui/SearchHighlight.vue';
import UserAvatar from '@/components/ui/UserAvatar.vue';
import { useStatusStyling } from '@/composables/useStatusStyling';
import { formatDate } from '@/lib/format';
import type { FacilityStatus, FacilitySummary } from '@/types';

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
const labels: Record<FacilityStatus, string> = {
  pending: '待受理', processing: '處理中', completed: '已完成', 'unable-to-handle': '無法處理',
};
const status = computed(() => props.facility.status);
const statusLabel = computed(() => labels[status.value]);
const isClosed = computed(() => status.value === 'completed' || status.value === 'unable-to-handle');
const { statusClass } = useStatusStyling(toRef(props.facility, 'status'), 'table-row');
</script>
