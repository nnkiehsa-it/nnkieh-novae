<template>
  <AdaptiveActionMenu ref="menuRef" :title="t(title)">
    <template #trigger="{ open, toggle }">
      <AppButton
        variant="toolbar"
        size="sm"
        class="w-8 rounded-full p-0"
        :class="{ 'text-ink-800 dark:text-ink-100': open }"
        :title="t(title)"
        :aria-label="t(title)"
        @click="toggle"
      >
        <AppIcon name="more-horizontal" :size="4.5" :stroke-width="1.8" />
      </AppButton>
    </template>

    <template #default="{ close }">
      <button
        type="button"
        class="dropdown-item dropdown-item--danger"
        :disabled="deleteDisabled"
        @click.stop="select(close)"
      >
        <AppIcon name="trash" :size="3" />
        <span>{{ t(deleteLabel) }}</span>
      </button>
    </template>
  </AdaptiveActionMenu>
</template>

<script setup lang="ts">
import AppButton from '@/components/ui/atoms/AppButton.vue';
import AppIcon from '@/components/ui/atoms/AppIcon.vue';
import AdaptiveActionMenu from '@/components/ui/organisms/AdaptiveActionMenu.vue';
import { useI18n } from '@/i18n';
import { ref } from 'vue';

const { t } = useI18n();

withDefaults(defineProps<{
  deleteDisabled?: boolean;
  deleteLabel?: string;
  title?: string;
}>(), {
  deleteDisabled: false,
  deleteLabel: 'announcement.deleteAnnouncement',
  title: 'common.manage',
});

const emit = defineEmits<{
  delete: [];
}>();
const menuRef = ref<InstanceType<typeof AdaptiveActionMenu> | null>(null);

function select(close: () => void) {
  close();
  emit('delete');
}
defineExpose({ open: () => menuRef.value?.open() });

</script>
