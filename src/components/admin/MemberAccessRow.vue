<template>
  <ListSurfaceRow as="div" class="flex flex-wrap items-center gap-3">
    <UserAvatar :photo-url="member.photoUrl" :name="member.name" size="md" />
    <div class="min-w-0 flex-1">
      <h4 class="truncate text-sm font-bold text-ink-900 dark:text-ink-100">{{ member.name }}</h4>
      <p class="mt-0.5 truncate text-xs text-ink-500">{{ member.email || member.uid }}</p>
      <p class="mt-1 text-xs text-ink-500">{{ summary }}</p>
      <p
        v-if="statusLabel"
        class="mt-1 text-xs font-semibold"
        :class="statusTone === 'success' ? 'text-success' : 'text-ink-500'"
      >
        {{ statusLabel }}
      </p>
    </div>
    <AppButton
      size="sm"
      :variant="actionVariant"
      class="shrink-0"
      :disabled="disabled"
      @click="emit('action')"
    >
      <BusyButtonContent :busy="busy" :label="actionLabel" :busy-label="busyLabel" />
    </AppButton>
  </ListSurfaceRow>
</template>

<script setup lang="ts">
import AppButton from '@/components/ui/atoms/AppButton.vue';
import BusyButtonContent from '@/components/ui/atoms/BusyButtonContent.vue';
import UserAvatar from '@/components/ui/atoms/UserAvatar.vue';
import ListSurfaceRow from '@/components/ui/molecules/ListSurfaceRow.vue';
import type { AccessUser } from '@/services/access';

withDefaults(defineProps<{
  actionLabel: string;
  actionVariant?: 'danger' | 'primary';
  busy: boolean;
  busyLabel: string;
  disabled?: boolean;
  member: AccessUser;
  statusLabel?: string;
  statusTone?: 'muted' | 'success';
  summary: string;
}>(), {
  actionVariant: 'primary',
  disabled: false,
  statusLabel: '',
  statusTone: 'muted',
});

const emit = defineEmits<{ action: [] }>();
</script>
