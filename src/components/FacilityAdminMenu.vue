<template>
  <AdaptiveActionMenu v-if="facility.canManageFacility" ref="menuRef" :title="t('facility.manageFacilities')">
    <template #trigger="{ open, toggle }">
      <AppButton
        variant="toolbar"
        size="sm"
        class="w-8 rounded-full p-0"
        :class="{ 'text-ink-800 dark:text-ink-100': open }"
        :title="t('facility.manageFacilities')"
        :aria-label="t('facility.manageFacilities')"
        @click="toggle"
      >
        <AppIcon name="more-horizontal" :size="4.5" :stroke-width="1.8" />
      </AppButton>
    </template>

    <template #default="{ close }">
      <button v-if="!closed" type="button" class="dropdown-item" @click="selectStatus(close)">
        <AppIcon name="edit" :size="3" />
        <span class="font-semibold">{{ t('facility.admin.changeStatus') }}</span>
      </button>
      <div class="mt-1 border-t border-error/20 pt-1">
        <button type="button" class="dropdown-item dropdown-item--danger" @click="selectDelete(close)">
          <AppIcon name="trash" :size="3" />
          <span>{{ t('facility.admin.delete') }}</span>
        </button>
      </div>
    </template>
  </AdaptiveActionMenu>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import AppButton from '@/components/ui/atoms/AppButton.vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import AdaptiveActionMenu from '@/components/ui/organisms/AdaptiveActionMenu.vue';
import { isFacilityClosed } from '@/constants/statuses';
import type { FacilitySummary } from '@/types';
import { useI18n } from '@/i18n';

const props = defineProps<{ facility: FacilitySummary }>();
const { t } = useI18n();
const emit = defineEmits<{ status: []; delete: [] }>();
const menuRef = ref<InstanceType<typeof AdaptiveActionMenu> | null>(null);
const closed = computed(() => isFacilityClosed(props.facility.status));

function selectStatus(close: () => void) { close(); emit('status'); }
function selectDelete(close: () => void) { close(); emit('delete'); }
defineExpose({ open: () => menuRef.value?.open() });
</script>
