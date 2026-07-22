<template>
  <DialogShell
    :open="open"
    :padded="false"
    :padded-surface="false"
    labelled-by="desktop-utility-title"
    :surface-class="activePanel === 'settings'
      ? 'desktop-utility-popup flex h-[min(86dvh,840px)] w-[min(90vw,1000px)] max-w-none overflow-hidden'
      : 'desktop-utility-popup flex h-[min(78dvh,720px)] w-[min(88vw,720px)] max-w-none overflow-hidden'"
    @close="emit('close')"
  >
    <div class="desktop-utility-content flex min-h-0 min-w-0 flex-1 overflow-hidden bg-[rgb(var(--color-page-background))]">
      <SettingsView v-if="activePanel === 'settings'" embedded @close="emit('close')" />
      <NotificationsView v-else embedded @close="emit('close')" />
    </div>
  </DialogShell>
</template>

<script setup lang="ts">
import DialogShell from '@/components/ui/organisms/DialogShell.vue';
import { defineAsyncComponent } from 'vue';

const SettingsView = defineAsyncComponent(() => import('@/views/SettingsView.vue'));
const NotificationsView = defineAsyncComponent(() => import('@/views/NotificationsView.vue'));

defineProps<{
  activePanel: 'notifications' | 'settings';
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>
