<template>
  <SurfacePanel variant="control" padding="sm">
    <ListSurfaceRow
      interactive
      :aria-disabled="disabled || undefined"
      :disabled="disabled || undefined"
      :class="disabled ? 'opacity-60' : ''"
      @click="emit('toggle')"
    >
      <span class="min-w-0 flex-1">
        <span class="block text-sm font-bold text-ink-950 dark:text-ink-50">{{ t(label) }}</span>
        <span class="mt-1 block text-xs leading-5 text-ink-500">{{ t(description) }}</span>
      </span>
      <SwitchIndicator :checked="enabled" :label="t(label)" />
    </ListSurfaceRow>
  </SurfacePanel>
</template>

<script setup lang="ts">
import SwitchIndicator from '@/components/ui/atoms/SwitchIndicator.vue';
import ListSurfaceRow from '@/components/ui/molecules/ListSurfaceRow.vue';
import SurfacePanel from '@/components/ui/molecules/SurfacePanel.vue';
import { useI18n } from '@/i18n';

defineProps<{
  description: string;
  disabled?: boolean;
  enabled: boolean;
  label: string;
}>();
const emit = defineEmits<{ toggle: [] }>();
const { t } = useI18n();
</script>
